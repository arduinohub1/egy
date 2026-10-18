let cart = JSON.parse(localStorage.getItem("arduino_hub_cart")) || [];
let currentUser = null;
let activeCategory = "All";
let searchQuery = "";
// FIX: `products` was never declared (implicit global). renderProducts() ran before the
// Firestore snapshot arrived and threw "ReferenceError: products is not defined".
let products = [];
let productsStatus = "loading"; // loading | ready | error

// --- PAGINATION STATE ---
let lastProductDoc = null;
let hasMoreProducts = true;
let isLoadingProducts = false;
const PAGE_SIZE = 24;

async function loadProductsPage(reset = false) {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    const db = firebase.firestore();
    
    if (reset) {
        lastProductDoc = null;
        hasMoreProducts = true;
        products = [];
        grid.innerHTML = ""; // Clear existing
        if (typeof loadProductsPage === "function" && document.getElementById("searchInput") === document.activeElement) { loadProductsPage(true); } else { renderProducts(); } // Shows loading skeleton
    }
    
    if (!hasMoreProducts || isLoadingProducts) return;
    
    isLoadingProducts = true;
    productsStatus = "loading";
    
    try {
        let query = db.collection("products");
        
        // Server-side filtering by category
        const isShop = window.location.pathname.includes('shop.html');
        if (!isShop) {
            query = query.where("isBestSeller", "==", true);
        } else if (activeCategory && activeCategory !== "All") {
            query = query.where("category", "==", activeCategory);
        }
        
        query = query.limit(PAGE_SIZE);
        
        if (lastProductDoc && !reset) {
            query = query.startAfter(lastProductDoc);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            hasMoreProducts = false;
        } else {
            lastProductDoc = snapshot.docs[snapshot.docs.length - 1];
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            
            // Note: Firebase lacks native full-text search. 
            // If searchQuery exists, we filter the fetched page in-memory as a fallback.
            // For true server-side search in Firebase, Algolia or ElasticSearch is required.
            let pageProducts = list;
            if (searchQuery && isShop) {
                const q = searchQuery.toLowerCase();
                pageProducts = pageProducts.filter(p => p.title.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q));
            }
            
            products = [...products, ...pageProducts];
        }
        
        productsStatus = "ready";
        renderHomeCategoryImages();
        renderProducts();
        
        if (hasMoreProducts && isShop) {
            appendLoadMoreButton();
        }
    } catch (err) {
        console.error("Error paginating products from DB:", err);
        productsStatus = "error";
        renderProducts();
    } finally {
        isLoadingProducts = false;
    }
}

function appendLoadMoreButton() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    
    // Remove old button if exists
    const oldBtn = document.getElementById("loadMoreBtnWrapper");
    if (oldBtn) oldBtn.remove();
    
    const wrapper = document.createElement("div");
    wrapper.id = "loadMoreBtnWrapper";
    wrapper.style.cssText = "width: 100%; display: flex; justify-content: center; padding: 30px 0; grid-column: 1 / -1;";
    
    const btn = document.createElement("button");
    btn.className = "btn-secondary";
    btn.innerText = "Load More Products";
    btn.onclick = () => {
        btn.innerText = "Loading...";
        btn.disabled = true;
        loadProductsPage();
    };
    
    wrapper.appendChild(btn);
    grid.appendChild(wrapper);
}

let banners = [];
let ads = [];

document.addEventListener("DOMContentLoaded", () => {
    injectMobileFixes();
    initLiveSearch();
    renderCart();
    if (typeof setupIosSwitchPill === 'function') setupIosSwitchPill();
    
        if (window.location.pathname.includes('shop.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('search')) {
            searchQuery = urlParams.get('search').toLowerCase();
            const searchInput = document.getElementById('searchInput');
            if(searchInput) {
                searchInput.value = searchQuery;
                searchInput.closest('.search-container')?.classList.toggle('has-value', Boolean(searchQuery));
            }
        }
        if (urlParams.has('category')) {
            const cat = urlParams.get('category');
            setTimeout(() => switchCategory(cat), 100);
        }
    }

    const localUser = JSON.parse(localStorage.getItem("arduino_hub_current_user"));
    handleUserState(localUser);
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.closest(".search-container")?.classList.toggle("has-value", Boolean(searchInput.value.trim()));
    
    // --- FIRESTORE DATABASE SYNC ---
    // The database is the ONLY source of products and banners. There are no
    // hardcoded defaults, no localStorage fallbacks and no seeding.
    productsStatus = "loading";
    renderProducts();

    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        const db = firebase.firestore();

        // If the database never answers (network down / blocked) stop the spinner
        // and show the empty state instead of hanging forever.
        const loadTimeout = setTimeout(() => {
            if (productsStatus === "loading") {
                productsStatus = "error";
                renderProducts();
            }
        }, 10000);

        // Real-time products
        db.collection("products").onSnapshot(snapshot => {
            clearTimeout(loadTimeout);
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            products = list;
            productsStatus = "ready";
            renderHomeCategoryImages();
            renderProducts();
            refreshSearchDropdown();
        }, err => {
            clearTimeout(loadTimeout);
            console.error("Error loading products from DB:", err);
            products = [];
            productsStatus = "error";
            renderHomeCategoryImages();
            renderProducts();
            refreshSearchDropdown();
        });

        // Real-time ads (promo cards managed from the admin dashboard)
        db.collection("ads").orderBy("createdAt", "asc").onSnapshot(snapshot => {
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            ads = list;
            renderAds();
        }, err => {
            console.error("Error loading ads from DB:", err);
            ads = [];
            renderAds();
        });

        // Real-time ad banners (managed from the admin dashboard)
        db.collection("banners").orderBy("createdAt", "asc").onSnapshot(snapshot => {
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            banners = list;
            renderBanners();
        }, err => {
            console.error("Error loading banners from DB:", err);
            banners = [];
            renderBanners();
        });
    } else {
        products = [];
        productsStatus = "error";
        renderProducts();
        renderBanners();
        renderAds();
    }

    // Display Home button only on shop page
    const homeBtnContainer = document.getElementById("homeBtnContainer");
    if (homeBtnContainer) {
        if (window.location.pathname.includes('shop.html')) {
            homeBtnContainer.innerHTML = '<a href="index.html" class="icon-btn mobile-home-btn" title="Home"><i class="fa-solid fa-house"></i></a>';
        } else {
            homeBtnContainer.innerHTML = '';
        }
    }
});

function injectMobileFixes() {
    if(document.getElementById("mobileFixStyle")) return;
    const style = document.createElement("style");
    style.id = "mobileFixStyle";
    style.innerHTML = `
        .category-card.active {
            border-color: var(--accent-blue) !important;
            transform: translateY(-4px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            background: rgba(10, 132, 255, 0.05);
        }
        @media (max-width: 576px) {
            #switchPill { display: none !important; }
            .ios-tab.active { background: rgba(255,255,255,0.15); border-radius: 99px; }
            .ios-switch-wrapper { justify-content: flex-start !important; margin: 10px 0 20px !important; }
            .ios-glass-switch {
                width: 100% !important;
                justify-content: flex-start !important;
            }
            .category-card { padding: 12px 8px !important; }
            .category-card i { font-size: 1.6rem !important; margin-bottom: 6px !important; }
            .category-card h4 { font-size: 0.85rem !important; }
        }
    `;
    document.head.appendChild(style);
}

function handleUserState(user) {
    currentUser = user;
    const navUser = document.getElementById("navUserLogged");
    const navLogin = document.getElementById("navLoginBtn");

    if (user) {
        if(navLogin) navLogin.style.display = "none";
        if(navUser) navUser.style.display = "flex";

        // Admin Recognition Check
        if (user.email === "admin@arduinohub.com" || user.name === "Admin") {
            const nameEl = document.getElementById("displayUserName");
            if (nameEl) nameEl.innerHTML = `<a href="admin.html" style="color:var(--accent-cyan); font-weight:800; text-decoration:none;">Dashboard <i class="fa-solid fa-arrow-right-to-bracket"></i></a>`;
        } else {
            const nameEl = document.getElementById("displayUserName");
            if (nameEl) nameEl.innerText = user.name || "User";
        }
        
        const avatarEl = document.getElementById("userAvatar");
        if (avatarEl) avatarEl.innerText = (user.name || "U").charAt(0).toUpperCase();
    } else {
        if(navLogin) navLogin.style.display = "inline-flex";
        if(navUser) navUser.style.display = "none";
    }
}

/* ============================================================
   LIVE SEARCH (autocomplete dropdown) - works on index.html & shop.html
   ============================================================ */
function escapeHTML(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Safe for use inside onclick="fn('...')" attributes (titles may contain apostrophes / quotes)
function escapeJsAttr(str) {
    return escapeHTML(String(str == null ? "" : str).replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
}

function injectSearchStyles() {
    if (document.getElementById("liveSearchStyle")) return;
    const style = document.createElement("style");
    style.id = "liveSearchStyle";
    style.innerHTML = `
        .search-container { position: relative; }
        .search-container .search-results-dropdown {
            position: absolute;
            top: calc(100% + 10px);
            right: 0;
            left: auto;
            width: 360px;
            min-width: 0;
            max-width: 92vw;
            max-height: 380px;
            overflow-y: auto;
            display: none;
            flex-direction: column;
            padding: 6px;
            gap: 2px;
            background: rgba(15, 23, 42, 0.92);
            -webkit-backdrop-filter: blur(20px);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.06);
            z-index: 2000;
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
        }
        .search-container .search-results-dropdown.active { display: flex; animation: searchDropIn 0.18s ease-out; }
        @keyframes searchDropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

        .search-container .search-item {
            display: grid;
            grid-template-columns: 44px minmax(0, 1fr) auto;
            align-items: center;
            gap: 12px;
            padding: 8px 10px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            text-decoration: none;
            color: var(--text-main, #f8fafc);
            transition: background 0.2s ease, transform 0.2s ease;
        }
        .search-container .search-item:last-child { border-bottom: none; }
        .search-container .search-item:hover,
        .search-container .search-item.focused { background: rgba(56, 189, 248, 0.12); transform: translateX(2px); }

        .search-container .search-item-thumb {
            width: 44px; height: 44px;
            display: flex; align-items: center; justify-content: center;
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
        }
        .search-container .search-item-thumb img { max-width: 86%; max-height: 86%; object-fit: contain; display: block; }

        .search-container .search-item-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .search-container .search-item-title {
            font-size: 0.88rem; font-weight: 600; line-height: 1.25;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .search-container .search-item-title mark { background: none; color: var(--accent-cyan, #38bdf8); font-weight: 800; }
        .search-container .search-item-cat { font-size: 0.72rem; color: var(--text-muted, #94a3b8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .search-container .search-item-price { font-size: 0.82rem; font-weight: 800; color: var(--accent-cyan, #38bdf8); white-space: nowrap; text-align: right; }
        .search-container .search-empty { padding: 18px 12px; text-align: center; font-size: 0.85rem; color: var(--text-muted, #94a3b8); }

        @media (max-width: 576px) {
            .search-container .search-results-dropdown { left: 0; right: 0; width: 100%; max-width: 100%; }
        }
    `;
    document.head.appendChild(style);
}

function getSearchDropdown() {
    let dd = document.getElementById("searchResultsDropdown");
    if (dd) return dd;
    // shop.html has no dropdown in its markup -> create it inside the search container
    const input = document.getElementById("searchInput");
    const container = input ? input.closest(".search-container") : null;
    if (!container) return null;
    dd = document.createElement("div");
    dd.id = "searchResultsDropdown";
    dd.className = "search-results-dropdown";
    container.appendChild(dd);
    return dd;
}

function initLiveSearch() {
    injectSearchStyles();
    const input = document.getElementById("searchInput");
    if (!input) return;
    getSearchDropdown();
    input.setAttribute("autocomplete", "off");

    input.addEventListener("focus", () => refreshSearchDropdown());

    // Keyboard navigation (Arrow keys / Escape)
    input.addEventListener("keydown", (e) => {
        const dd = getSearchDropdown();
        if (!dd || !dd.classList.contains("active")) return;
        const items = Array.from(dd.querySelectorAll(".search-item"));
        if (items.length === 0) return;
        let idx = items.findIndex(i => i.classList.contains("focused"));

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (idx > -1) items[idx].classList.remove("focused");
            idx = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx <= 0 ? items.length - 1 : idx - 1);
            items[idx].classList.add("focused");
            items[idx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter" && idx > -1) {
            e.preventDefault();
            items[idx].click();
        } else if (e.key === "Escape") {
            closeSearchDropdown();
        }
    });

    // Close when clicking outside the search area
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-container")) closeSearchDropdown();
    });
}

function closeSearchDropdown() {
    const dd = document.getElementById("searchResultsDropdown");
    if (dd) dd.classList.remove("active");
}

function highlightMatch(text, query) {
    const safe = escapeHTML(text);
    if (!query) return safe;
    const q = escapeHTML(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
        return safe.replace(new RegExp("(" + q + ")", "ig"), "<mark>$1</mark>");
    } catch (err) {
        return safe;
    }
}

function refreshSearchDropdown() {
    const input = document.getElementById("searchInput");
    const dd = getSearchDropdown();
    if (!input || !dd) return;

    const q = input.value.trim().toLowerCase();
    if (!q || document.activeElement !== input) {
        // Only keep the dropdown open while the user is actually typing in the field
        if (!q) closeSearchDropdown();
        return;
    }

    const list = Array.isArray(products) ? products : [];
    const matches = list.filter(p =>
        (p.title || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
    ).slice(0, 6);

    if (matches.length === 0) {
        dd.innerHTML = '<div class="search-empty">No products found for "' + escapeHTML(input.value.trim()) + '"</div>';
    } else {
        dd.innerHTML = matches.map(p => {
            const hasOffer = p.offerPrice && p.offerPrice !== "";
            const price = hasOffer ? parseFloat(p.offerPrice) : parseFloat(p.price);
            return `
                <div class="search-item" onclick="selectSearchResult('${escapeJsAttr(p.title)}')">
                    <div class="search-item-thumb"><img src="${escapeHTML(p.image)}" alt="" onerror="this.style.visibility='hidden'"></div>
                    <div class="search-item-info">
                        <span class="search-item-title">${highlightMatch(p.title, input.value.trim())}</span>
                        <span class="search-item-cat">${escapeHTML(p.category)}</span>
                    </div>
                    <span class="search-item-price">EGP ${isNaN(price) ? "0.00" : price.toFixed(2)}</span>
                </div>`;
        }).join("");
    }
    dd.classList.add("active");
}

function selectSearchResult(title) {
    const input = document.getElementById("searchInput");
    closeSearchDropdown();
    if (window.location.pathname.includes('shop.html')) {
        if (input) {
            input.value = title;
            input.closest(".search-container")?.classList.toggle("has-value", Boolean(title));
        }
        searchQuery = title.toLowerCase();
        renderProducts();
        const prodSec = document.getElementById("productsSection");
        if (prodSec) prodSec.scrollIntoView({ behavior: "smooth" });
    } else {
        window.location.href = 'shop.html?search=' + encodeURIComponent(title);
    }
}

function handleSearch(e) {
    if (e.key === 'Enter') {
        if (!window.location.pathname.includes('shop.html')) {
            window.location.href = 'shop.html?search=' + encodeURIComponent(e.target.value);
        } else {
            closeSearchDropdown();
        }
    }
}

function handleSearchInput(e) {
    const value = e.target.value.trim();
    e.target.closest(".search-container")?.classList.toggle("has-value", Boolean(value));
    if (window.location.pathname.includes('shop.html')) {
        searchQuery = value.toLowerCase();
        renderProducts();
    }
    refreshSearchDropdown();
}

function clearProductSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;
    input.value = "";
    input.closest(".search-container")?.classList.remove("has-value");
    searchQuery = "";
    closeSearchDropdown();
    if (window.location.pathname.includes("shop.html")) renderProducts();
    input.focus();
}

function setupIosSwitchPill() {
    if (window.innerWidth <= 576) return; // Managed by CSS purely on mobile
    const activeTab = document.querySelector(".ios-tab.active");
    if(activeTab) updatePillPosition(activeTab);
}

function switchCategory(cat, btn) {
    if (!window.location.pathname.includes('shop.html')) {
        window.location.href = 'shop.html?category=' + encodeURIComponent(cat);
        return;
    }

    activeCategory = cat;
    document.querySelectorAll(".ios-tab").forEach(t => t.classList.remove("active"));
    
    if(!btn) { 
        const tabs = Array.from(document.querySelectorAll(".ios-tab"));
        const targetTab = tabs.find(t => t.dataset.category === cat || t.innerText.includes(cat) || t.innerText === "Wires & Accessories" && cat === "Wires & Modules");
        if (targetTab) {
            targetTab.classList.add("active");
            if (window.innerWidth > 576) updatePillPosition(targetTab);
        }
    } else {
        btn.classList.add("active");
        if (window.innerWidth > 576) updatePillPosition(btn);
    }
    
    document.querySelectorAll(".category-card").forEach(c => c.classList.remove("active"));
    const cards = Array.from(document.querySelectorAll(".category-card"));
    const targetCard = cards.find(c => c.dataset.category === cat || c.getAttribute("onclick") && c.getAttribute("onclick").includes("'" + cat + "'"));
    if (targetCard) {
        targetCard.classList.add("active");
    }
    
    const prodSec = document.getElementById("productsSection");
    if (prodSec) prodSec.scrollIntoView({ behavior: "smooth" });
    renderProducts();
}

function updatePillPosition(element) {
    const pill = document.getElementById("switchPill");
    if(pill && element && window.innerWidth > 576) {
        const w = element.offsetWidth;
        const h = element.offsetHeight;
        if (w > 0) {
            pill.style.width = w + "px";
            pill.style.height = h + "px";
            pill.style.transform = "translate(" + (element.offsetLeft - 4) + "px, " + (element.offsetTop - 4) + "px)";
        }
    }
}

window.addEventListener('load', () => {
    if (typeof setupIosSwitchPill === 'function') setTimeout(setupIosSwitchPill, 100);
});
window.addEventListener('resize', () => {
    if (typeof setupIosSwitchPill === 'function') setupIosSwitchPill();
});


/* ============================================================
   AD BANNERS - rendered only from the "banners" collection
   ============================================================ */
let bannerTimer = null;

function safeImageSrc(src) {
    const s = String(src == null ? "" : src).trim();
    if (!s) return "";
    return /^(data:image\/(png|jpe?g|webp|gif);base64,|https?:\/\/|[\w\-./]+$)/i.test(s) ? s : "";
}

function safeLink(url) {
    const u = String(url == null ? "" : url).trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return /^[\w\-./]+(\?[\w\-=&%.]*)?(#[\w\-]*)?$/.test(u) ? u : "";
}

function renderBanners() {
    const box = document.getElementById("adBanners");
    if (!box) return;
    if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }

    const list = banners.filter(b => safeImageSrc(b.image));
    box.innerHTML = "";
    if (list.length === 0) { box.hidden = true; return; }   // nothing set in admin -> show nothing
    box.hidden = false;

    const slider = document.createElement("div");
    slider.className = "ad-slider";
    const slides = [];
    const dots = [];

    list.forEach((b, i) => {
        const href = safeLink(b.link);
        const slide = document.createElement(href ? "a" : "div");
        slide.className = "ad-slide" + (i === 0 ? " active" : "");
        if (href) {
            slide.href = href;
            if (/^https?:\/\//i.test(href) && href.indexOf(window.location.origin) !== 0) {
                slide.target = "_blank";
                slide.rel = "noopener noreferrer";
            }
        }
        const img = document.createElement("img");
        img.src = safeImageSrc(b.image);
        img.alt = b.title ? String(b.title) : "Advertisement";
        img.loading = i === 0 ? "eager" : "lazy";
        img.addEventListener("error", () => { slide.remove(); });
        slide.appendChild(img);
        slider.appendChild(slide);
        slides.push(slide);
    });

    let current = 0;
    function show(n) {
        current = (n + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle("active", i === current));
        dots.forEach((d, i) => d.classList.toggle("active", i === current));
    }

    if (slides.length > 1) {
        const dotsWrap = document.createElement("div");
        dotsWrap.className = "ad-dots";
        slides.forEach((_, i) => {
            const d = document.createElement("button");
            d.type = "button";
            d.className = "ad-dot" + (i === 0 ? " active" : "");
            d.setAttribute("aria-label", "Show banner " + (i + 1));
            d.addEventListener("click", () => show(i));
            dots.push(d);
            dotsWrap.appendChild(d);
        });
        slider.appendChild(dotsWrap);

        let paused = false;
        slider.addEventListener("mouseenter", () => { paused = true; });
        slider.addEventListener("mouseleave", () => { paused = false; });
        bannerTimer = setInterval(() => { if (!paused) show(current + 1); }, 5000);
    }
    box.appendChild(slider);
}

const CATEGORY_PRESENTATION = [
    { match: /microcontroller|arduino|\bboard\b/i, label: "Arduino Boards", icon: "fa-microchip" },
    { match: /sensor/i, label: "Sensors", icon: "fa-satellite-dish" },
    { match: /module/i, label: "Modules", icon: "fa-cubes" },
    { match: /wire|cable/i, label: "Cables & Wires", icon: "fa-plug" },
    { match: /power|battery|supply/i, label: "Power", icon: "fa-battery-full" },
    { match: /motor/i, label: "Motors", icon: "fa-fan" },
    { match: /display|screen|lcd/i, label: "Displays", icon: "fa-display" },
    { match: /tool/i, label: "Tools", icon: "fa-screwdriver-wrench" },
    { match: /component/i, label: "Components", icon: "fa-gears" }
];

const CATEGORY_ICON_DRAWINGS = Object.freeze({
    "fa-microchip": '<rect x="13" y="13" width="22" height="22" rx="4"/><path d="M18 18h12v12H18zM18 7v6m6-6v6m6-6v6M18 35v6m6-6v6m6-6v6M7 18h6m-6 6h6m-6 6h6m22-12h6m-6 6h6m-6 6h6"/>',
    "fa-satellite-dish": '<circle cx="24" cy="24" r="5"/><path d="M24 19a11 11 0 0 0-11 11m11-17A17 17 0 0 0 7 30m17-17a17 17 0 0 1 17 17M24 7a23 23 0 0 1 23 23M24 29l-8 12h16l-8-12Z"/>',
    "fa-cubes": '<path d="m24 7 13 7-13 7-13-7 13-7Z"/><path d="M11 14v15l13 7 13-7V14M24 21v15"/><path d="m7 29 9 5m25-5-9 5"/>',
    "fa-plug": '<path d="M16 8v12m16-12v12M12 20h24v3a12 12 0 0 1-12 12v5m0-5A12 12 0 0 1 12 23v-3Z"/><path d="M24 40v2"/>',
    "fa-battery-full": '<rect x="8" y="13" width="32" height="23" rx="4"/><path d="M40 20h3v9h-3M15 19v11m-5-5h10m8-6v12m-5-6h10"/>',
    "fa-fan": '<circle cx="24" cy="24" r="4"/><path d="M24 20c-2-11 1-15 6-14 6 1 3 9-2 15m0 3c11-2 15 1 14 6-1 6-9 3-15-2m-3 0c2 11-1 15-6 14-6-1-3-9 2-15m0-3c-11 2-15-1-14-6 1-6 9-3 15 2"/><circle cx="24" cy="24" r="17"/>',
    "fa-display": '<rect x="7" y="9" width="34" height="25" rx="4"/><path d="M18 41h12m-6-7v7m-12-24h24v13H12z"/>',
    "fa-screwdriver-wrench": '<path d="m8 9 8 8m-4-11 8 8-6 6-8-8 2-6Zm13 11 13 13a4 4 0 0 1-6 6L21 23m7-8a9 9 0 0 0 12 10l-7 7"/><circle cx="12" cy="36" r="4"/>',
    "fa-gears": '<circle cx="18" cy="19" r="6"/><circle cx="31" cy="30" r="5"/><path d="M18 9v4m0 12v4m-10-10h4m12 0h4m-17-7 3 3m8 8 3 3m-14 0 3-3m8-8 3-3m10 8v4m0 10v4m-7-9h4m6 0h4m-16-6 3 3m8 8 3 3m-14 0 3-3m8-8 3-3"/>',
    "fa-cube": '<path d="m24 6 16 9v18l-16 9-16-9V15l16-9Z"/><path d="m8 15 16 9 16-9M24 24v18"/>'
});

function createCategoryIcon(iconName) {
    const wrapper = document.createElement("span");
    wrapper.className = "category-icon-wrap";
    const drawing = CATEGORY_ICON_DRAWINGS[iconName] || CATEGORY_ICON_DRAWINGS["fa-cube"];
    wrapper.innerHTML = `<svg class="category-icon-svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawing}</svg>`;
    return wrapper;
}

function getCategoryPresentation(category) {
    const configured = CATEGORY_PRESENTATION.find(item => item.match.test(category));
    return configured || { label: category, icon: "fa-cube" };
}

function renderCategoryCards() {
    const grids = Array.from(document.querySelectorAll("[data-catalog-categories]"));
    if (!grids.length || productsStatus !== "ready") return;

    const categoryCounts = new Map();
    products.filter(isValidProduct).forEach(product => {
        const category = String(product.category || "").trim();
        if (category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
    const categories = Array.from(categoryCounts.keys()).sort((a, b) => {
        const countDiff = categoryCounts.get(b) - categoryCounts.get(a);
        return countDiff || a.localeCompare(b);
    });
    window.dispatchEvent(new CustomEvent("arduino-hub:categories-ready", { detail: { categories } }));
    const categoryHeader = document.getElementById("categories");
    if (categoryHeader) categoryHeader.hidden = categories.length === 0;

    grids.forEach(grid => {
        if (!categories.length) {
            grid.hidden = true;
            return;
        }
        grid.hidden = false;
        const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            const presentation = getCategoryPresentation(category);
            const product = products.find(item => item.category === category && safeImageSrc(item.image));
            const card = document.createElement("a");
            card.className = "category-card home-category-card";
            card.dataset.category = category;
            card.href = "shop.html?category=" + encodeURIComponent(category);
            if (grid.id === "shopCategoryCards") {
                card.addEventListener("click", event => {
                    event.preventDefault();
                    switchCategory(category);
                });
            }

            if (product) {
                const image = document.createElement("img");
                image.className = "category-product-image";
                image.src = safeImageSrc(product.image);
                image.alt = "";
                image.loading = "lazy";
                image.decoding = "async";
                image.addEventListener("error", () => {
                    image.replaceWith(createCategoryIcon(presentation.icon));
                }, { once: true });
                card.appendChild(image);
            } else {
                card.appendChild(createCategoryIcon(presentation.icon));
            }

            const label = document.createElement("h4");
            label.textContent = presentation.label;
            card.appendChild(label);
            fragment.appendChild(card);
        });
        grid.replaceChildren(fragment);
    });

    renderCategoryTabs(categories);
}

function renderCategoryTabs(categories) {
    const switcher = document.getElementById("categorySwitch");
    if (!switcher || productsStatus !== "ready") return;
    if (activeCategory !== "All" && !categories.includes(activeCategory)) activeCategory = "All";
    const pill = switcher.querySelector(".switch-pill");
    const fragment = document.createDocumentFragment();
    if (pill) fragment.appendChild(pill);

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "ios-tab" + (activeCategory === "All" ? " active" : "");
    allButton.dataset.category = "All";
    allButton.textContent = "All Products";
    allButton.addEventListener("click", () => switchCategory("All", allButton));
    fragment.appendChild(allButton);

    categories.forEach(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ios-tab" + (activeCategory === category ? " active" : "");
        button.dataset.category = category;
        button.textContent = getCategoryPresentation(category).label;
        button.addEventListener("click", () => switchCategory(category, button));
        fragment.appendChild(button);
    });

    switcher.replaceChildren(fragment);
    if (typeof setupIosSwitchPill === "function") setupIosSwitchPill();
}

function getProductTimestamp(product) {
    const value = product.createdAt || product.created_at || product.createdOn || product.dateAdded;
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function renderNewArrivals() {
    const section = document.getElementById("newArrivalsSection");
    const grid = document.getElementById("newArrivalsGrid");
    if (!section || !grid || productsStatus === "loading") return;

    const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const arrivals = products.filter(product => {
        const added = getProductTimestamp(product);
        return isValidProduct(product) && (product.isNewArrival === true || added >= recentCutoff && added <= Date.now());
    }).sort((a, b) => getProductTimestamp(b) - getProductTimestamp(a)).slice(0, 8);

    if (!arrivals.length) {
        section.hidden = false;
        grid.hidden = false;
        renderProductsState(grid, "fa-box-open", "New arrivals will appear here when newly added products are available.");
        return;
    }
    section.hidden = false;
    grid.hidden = false;
    const fragment = document.createDocumentFragment();
    arrivals.forEach(product => fragment.appendChild(createProductCard(product)));
    grid.replaceChildren(fragment);
}

// Category products are drawn from the live catalog; icons fill in only when
// the catalog has no suitable image for that category.
function renderHomeCategoryImages() {
    if (!(document.body.classList.contains("premium-home") || document.body.classList.contains("premium-shop")) || !Array.isArray(products)) return;
    renderCategoryCards();
}

/* ============================================================
   PRODUCT CARD - fixed size, built only from database fields
   (layout/size is defined in store-ui.css)
   ============================================================ */
function isValidProduct(p) {
    return p && typeof p.title === "string" && p.title.trim() !== "" && isFinite(parseFloat(p.price));
}

const FAVORITES_STORAGE_KEY = "arduino_hub_favorites";

function readFavoriteProducts() {
    try {
        const saved = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        return [];
    }
}

function isFavoriteProduct(productId) {
    return readFavoriteProducts().some(p => String(p.id) === String(productId));
}

function toggleFavoriteProduct(product) {
    const favorites = readFavoriteProducts();
    const index = favorites.findIndex(p => String(p.id) === String(product.id));
    let saved;

    if (index >= 0) {
        favorites.splice(index, 1);
        saved = false;
    } else {
        favorites.push({
            id: product.id,
            title: product.title,
            image: safeImageSrc(product.image),
            price: product.price,
            offerPrice: product.offerPrice,
            rating: product.rating,
            category: product.category
        });
        saved = true;
    }

    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch (e) {
        console.warn("Could not save favorites on this device:", e);
    }

    document.querySelectorAll(".product-favorite").forEach(button => {
        const active = isFavoriteProduct(button.dataset.favoriteId);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", active ? "Remove from favorites" : "Add to favorites");
        button.innerHTML = `<i class="fa-${active ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>`;
    });
    window.dispatchEvent(new CustomEvent("arduino-hub:favorites-changed"));
    return saved;
}

function renderProductsState(grid, icon, message) {
    grid.innerHTML = `<div class="products-state"><i class="fa-solid ${icon}"></i>${escapeHTML(message)}</div>`;
}

function createProductCard(p) {
    const price = parseFloat(p.price);
    const offer = parseFloat(p.offerPrice);
    const hasOffer = p.offerPrice !== "" && p.offerPrice != null && isFinite(offer) && offer > 0;
    const isDiscount = hasOffer && offer < price;
    const finalPrice = hasOffer ? offer : price;
    const ratingValue = p.rating !== "" && p.rating != null ? parseFloat(p.rating) : NaN;
    const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
    const rating = hasRating ? Math.min(5, Math.max(0, ratingValue)) : 0;
    const imgSrc = safeImageSrc(p.image);

    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
        ${isDiscount ? '<span class="sale-badge">SALE</span>' : ''}
        <div class="product-img-box${imgSrc ? '' : ' no-img'}">
            ${imgSrc ? `<img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(p.title)}" loading="lazy">` : ''}
        </div>
        <div class="product-info">
            <h3 class="product-title" title="${escapeHTML(p.title)}">${escapeHTML(p.title)}</h3>
            <div class="product-rating" title="Click to rate">
                <span>${getStarsHTML(rating)}</span>
                <span class="rating-num">${hasRating ? `(${rating.toFixed(1)})` : "Rate"}</span>
            </div>
        </div>
        <div class="product-price-bar">
            <div class="price-box">
                <span class="price-old">${isDiscount ? 'EGP ' + price.toFixed(2) : ''}</span>
                <span class="price-val${isDiscount ? ' is-offer' : ''}">EGP ${finalPrice.toFixed(2)}</span>
            </div>
            <button type="button" class="btn-buy-now">Buy Now</button>
        </div>
    `;

    const img = card.querySelector(".product-img-box img");
    if (img) img.addEventListener("error", () => img.parentElement.classList.add("no-img"));
    const ratingControl = card.querySelector(".product-rating");
    if (ratingControl) ratingControl.addEventListener("click", () => openRatingModal(p.id, p.title));
    card.querySelector(".btn-buy-now").addEventListener("click", () => buyNowDirect(p.id));
    return card;
}

function renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    if (productsStatus === "loading") {
        renderProductsState(grid, "fa-spinner fa-spin", "Loading products...");
        renderNewArrivals();
        return;
    }

    let filtered = products.filter(isValidProduct);
    const isShop = window.location.pathname.includes('shop.html');
    const hadAny = filtered.length > 0;

    if (isShop) {
        if (activeCategory !== "All") filtered = filtered.filter(p => p.category === activeCategory);
        if (searchQuery) {
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(searchQuery) ||
                String(p.category || "").toLowerCase().includes(searchQuery));
        }
    } else {
        // HOME PAGE: only products explicitly marked Best Seller in the admin. No fallback.
        filtered = filtered.filter(p => p.isBestSeller === true);
    }

    if (filtered.length === 0) {
        const filteredOut = isShop && hadAny;
        renderProductsState(grid, "fa-box-open", filteredOut ? "No products match your search." : "No products available");
        renderNewArrivals();
        return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(p => frag.appendChild(createProductCard(p)));
    grid.innerHTML = "";
    grid.appendChild(frag);
    renderNewArrivals();
}

function buyNowDirect(productId) {
    const prod = products.find(p => p.id === productId);
    if(!prod) return;
    
    const finalPrice = prod.offerPrice && prod.offerPrice !== "" ? parseFloat(prod.offerPrice) : parseFloat(prod.price);
    const existing = cart.find(i => i.id === productId);
    
    if(existing) existing.qty += 1;
    else cart.push({ id: prod.id, title: prod.title, price: finalPrice, image: prod.image, qty: 1 });

    localStorage.setItem("arduino_hub_cart", JSON.stringify(cart));
    renderCart();
    toggleCart(true); 
}

function renderCart() {
    const container = document.getElementById("cartItemsContainer");
    const badge = document.getElementById("cartCount");
    const totalEl = document.getElementById("cartTotalPrice");
    if (!container) return;
    
    container.innerHTML = "";
    if (cart.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "cart-empty-state";
        emptyState.innerHTML = `
            <span class="cart-empty-state__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.4 11.1a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 7H5"/></svg></span>
            <h4>Your cart is empty</h4>
            <p>Explore the shop and add the parts you need for your next project.</p>
            <a class="cart-empty-state__link" href="shop.html#productsSection">Browse products <span aria-hidden="true">→</span></a>
        `;
        container.appendChild(emptyState);
    }
    let total = 0, count = 0;
    cart.forEach(item => {
        total += item.price * item.qty;
        count += item.qty;

        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; padding:15px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <img src="${escapeHTML(safeImageSrc(item.image))}" style="width:50px; height:50px; object-fit:contain;">
                <div style="flex:1;">
                    <div style="font-size:0.88rem; font-weight:600; margin-bottom:10px; line-height:1.3;">${escapeHTML(item.title)}</div>
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div style="display:flex; align-items:center; gap: 14px;">
                            <button onclick="updateCartQty('${escapeJsAttr(item.id)}', -1)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem; font-weight:300; display:flex; align-items:center; justify-content:center; padding: 0; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='var(--text-muted)'">&minus;</button>
                            <span style="font-size:0.95rem; font-weight:600; min-width:20px; text-align:center;">${item.qty}</span>
                            <button onclick="updateCartQty('${escapeJsAttr(item.id)}', 1)" style="background:none; border:none; color:var(--text-main); cursor:pointer; font-size:1.2rem; font-weight:300; display:flex; align-items:center; justify-content:center; padding: 0; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='var(--text-main)'">&plus;</button>
                        </div>
                        <div style="color:var(--accent-cyan); font-weight:800; font-size:1rem;">EGP ${(item.price * item.qty).toFixed(2)}</div>
                    </div>
                </div>
                <button onclick="removeFromCart('${escapeJsAttr(item.id)}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem; display:flex; align-items:center; justify-content:center; transition:0.2s; padding-left:10px;" onmouseover="this.style.color='#ef4444';" onmouseout="this.style.color='var(--text-muted)';"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });

    if (badge) badge.innerText = count;
    if (totalEl) totalEl.innerText = "EGP " + total.toFixed(2);
    const mobileCount = document.getElementById("mobileCartCount");
    if (mobileCount) mobileCount.innerText = String(count);
    window.dispatchEvent(new CustomEvent("arduino-hub:cart-changed", { detail: { count } }));
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    localStorage.setItem("arduino_hub_cart", JSON.stringify(cart));
    renderCart();
}

function toggleCart(open) {
    const overlay = document.getElementById("cartOverlay");
    const drawer = document.getElementById("cartDrawer");
    if (overlay) overlay.classList.toggle("open", open);
    if (drawer) drawer.classList.toggle("open", open);
    document.body.classList.toggle("cart-open", Boolean(open));
    const fab = document.getElementById("aicb-fab");
    if (fab) {
        if (open) fab.style.setProperty("display", "none", "important");
        else fab.style.removeProperty("display");
    }
    const panel = document.getElementById("aicb-panel");
    if (panel && open) panel.classList.remove("open");
}

function handleCheckout() {
    if (cart.length === 0) return alert("Cart is empty!");
    
    // FIX: Guest checkout. Previously guests were bounced to login.html here.
    // checkout.html already handles both logged-in users and guests (userId = "Guest").
    window.location.href = "checkout.html";
}

function handleLogout() {
    localStorage.removeItem("arduino_hub_current_user");
    window.location.reload();
}

function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.innerText = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
}


// --- RATING SYSTEM ---
let currentRatingProductId = null;

function getStarsHTML(rating) {
    let html = '';
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    
    for(let i=0; i<5; i++) {
        if(i < fullStars) html += '<i class="fa-solid fa-star"></i>';
        else if(i === fullStars && hasHalf) html += '<i class="fa-solid fa-star-half-stroke"></i>';
        else html += '<i class="fa-regular fa-star"></i>';
    }
    return html;
}

function openRatingModal(productId, productTitle) {
    if (!currentUser) {
        alert("Please Log In or Create an Account to rate products.");
        window.location.href = "login.html";
        return;
    }
    if (currentUser.email === "admin@arduinohub.com") {
        alert("Admins cannot rate products.");
        return;
    }
    
    currentRatingProductId = productId;
    document.getElementById("ratingProductName").innerText = productTitle;
    
    // Clear previous selection
    document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
    
    document.getElementById("ratingModal").classList.add("open");
}

function closeRatingModal() {
    document.getElementById("ratingModal").classList.remove("open");
    currentRatingProductId = null;
}

function submitRating() {
    const selected = document.querySelector('input[name="rating"]:checked');
    if(!selected) return alert("Please select a star rating.");
    
    const newRating = parseInt(selected.value);
    
    const prodIndex = products.findIndex(p => p.id === currentRatingProductId);
    if(prodIndex > -1) {
        let currentAvg = products[prodIndex].rating || 5.0;
        let updatedAvg = ((currentAvg * 5) + newRating) / 6; 
        const finalRating = parseFloat(updatedAvg.toFixed(1));
        
        products[prodIndex].rating = finalRating;
        renderProducts();
        closeRatingModal();
        showToast("Thank you for your rating!");
        
        // Push update to Firestore
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            firebase.firestore().collection("products").doc(currentRatingProductId).update({
                rating: finalRating
            });
        }
    }
}

function updateCartQty(id, change) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    item.qty += change;
    if (item.qty <= 0) {
        removeFromCart(id);
    } else {
        localStorage.setItem("arduino_hub_cart", JSON.stringify(cart));
        renderCart();
    }
}

/* ============================================================
   ADS - promo cards rendered only from the "ads" collection
   ============================================================ */
function renderAds() {
    const grid = document.getElementById("adsGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const list = ads.filter(a => a && (a.title || a.desc));
    if (list.length === 0) { grid.hidden = true; return; }
    grid.hidden = false;

    list.forEach((a, i) => {
        const card = document.createElement("div");
        card.className = "promo-card";

        const body = document.createElement("div");
        if (a.tag) {
            const tag = document.createElement("span");
            tag.style.cssText = "color: var(--accent-cyan); font-weight: 700;";
            tag.textContent = a.tag;
            body.appendChild(tag);
        }
        if (a.title) {
            const h = document.createElement("h3");
            h.style.cssText = "font-size: 1.8rem; margin: 8px 0;";
            h.textContent = a.title;
            body.appendChild(h);
        }
        if (a.desc) {
            const p = document.createElement("p");
            p.style.color = "var(--text-muted)";
            p.textContent = a.desc;
            body.appendChild(p);
        }
        card.appendChild(body);

        if (a.btnText) {
            const btn = document.createElement("a");
            btn.href = safeLink(a.link) || "shop.html";
            btn.className = i % 2 === 0 ? "btn-secondary" : "btn-primary";
            btn.style.cssText = "width: fit-content; margin-top: 20px;";
            btn.textContent = a.btnText;
            if (/^https?:\/\//i.test(btn.href) && btn.href.indexOf(window.location.origin) !== 0) {
                btn.target = "_blank";
                btn.rel = "noopener noreferrer";
            }
            card.appendChild(btn);
        }
        grid.appendChild(card);
    });
}















