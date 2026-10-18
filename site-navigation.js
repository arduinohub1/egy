(() => {
    const USER_KEY = "arduino_hub_current_user";
    const CART_KEY = "arduino_hub_cart";

    const ICON_PATHS = {
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        close: '<path d="m18 6-12 12M6 6l12 12"/>',
        user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="5"/>',
        home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>',
        store: '<path d="M3 10h18l-1.5-6h-15L3 10Z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/><path d="M3 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 4 1"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        bot: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M2 14h2m16 0h2M9 13h.01M15 13h.01M9 17h6"/>',
        heart: '<path d="M20.8 8.6c0 5.4-8.8 10.4-8.8 10.4S3.2 14 3.2 8.6A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.8 2.2Z"/>',
        cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.4 11.1a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 7H5"/>',
        tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
        chevronRight: '<path d="m9 18 6-6-6-6"/>',
        chevronDown: '<path d="m6 9 6 6 6-6"/>',
        arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        login: '<path d="M15 3h3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-3"/><path d="m10 17 5-5-5-5M15 12H3"/>',
        logout: '<path d="M9 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h3"/><path d="m16 17 5-5-5-5M21 12H9"/>',
        dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'
    };

    function siteIcon(name) {
        return '<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || ICON_PATHS.grid) + '</svg>';
    }

    function readUser() {
        try {
            const user = JSON.parse(localStorage.getItem(USER_KEY));
            return user && typeof user === "object" ? user : null;
        } catch (error) {
            return null;
        }
    }

    function readCartCount() {
        try {
            const cart = JSON.parse(localStorage.getItem(CART_KEY));
            return Array.isArray(cart) ? cart.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0) : 0;
        } catch (error) {
            return 0;
        }
    }

    function refreshAccountLink() {
        const link = document.getElementById("siteMenuAccountLink");
        const name = document.getElementById("siteMenuAccountName");
        const detail = document.getElementById("siteMenuAccountDetail");
        const avatar = document.getElementById("siteMenuAccountAvatar");
        const chevron = document.getElementById("siteMenuAccountChevron");
        const logoutBtn = document.getElementById("siteMenuLogoutBtn");
        if (!link || !name || !detail || !avatar) return;

        const user = readUser();
        link.classList.remove("show-logout");
        if (logoutBtn) logoutBtn.hidden = true;
        if (chevron) chevron.hidden = false;

        if (user) {
            const displayName = String(user.name || user.email || "Account").trim();
            link.href = "#";
            name.textContent = displayName;
            detail.textContent = "View your account";
            avatar.textContent = (displayName.charAt(0) || "A").toUpperCase();
            avatar.classList.add("has-initial");
        } else {
            link.href = "login.html";
            name.textContent = "Guest";
            detail.textContent = "Login or Create Account";
            avatar.innerHTML = siteIcon("user");
            avatar.classList.remove("has-initial");
        }
        const current = location.pathname.split("/").pop().toLowerCase();
        if (current === "login.html") link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    }

    function refreshCartCount() {
        const count = document.getElementById("mobileCartCount");
        if (count) {
            const total = readCartCount();
            count.textContent = String(total);
            count.setAttribute("aria-label", total + " items in cart");
            const cartLink = count.closest("[data-cart-nav]");
            if (cartLink) cartLink.setAttribute("aria-label", "Cart, " + total + " items");
        }
        const menuCount = document.getElementById("siteMenuCartCount");
        if (menuCount) menuCount.textContent = String(readCartCount());
    }

    function renderCategoryLinks(categories) {
        const list = document.getElementById("siteCategoryLinks");
        if (!list || !Array.isArray(categories)) return;
        list.replaceChildren();
        categories.forEach(category => {
            const value = String(category || "").trim();
            if (!value) return;
            const link = document.createElement("a");
            link.href = "shop.html?category=" + encodeURIComponent(value);
            link.className = "site-menu__category-link";
            link.innerHTML = siteIcon("grid");
            const label = document.createElement("span");
            label.textContent = value;
            link.appendChild(label);
            list.appendChild(link);
        });
        const all = document.createElement("a");
        all.className = "site-menu__category-all";
        all.href = "shop.html#categories";
        all.innerHTML = siteIcon("arrowRight");
        const allLabel = document.createElement("span");
        allLabel.textContent = "Browse all categories";
        all.appendChild(allLabel);
        list.appendChild(all);
    }


    function isAdminUser(user) {
        return !!user && (user.email === "admin@arduinohub.com" || user.name === "Admin");
    }

    function signOut() {
        // Same session contract as products.js / account.js: the active user lives in localStorage.
        if (typeof window.handleLogout === "function") { window.handleLogout(); return; }
        localStorage.removeItem(USER_KEY);
        window.dispatchEvent(new CustomEvent("arduino-hub:user-changed"));
        window.location.reload();
    }

    function closeAccountMenus(except) {
        document.querySelectorAll(".hub-account.is-open").forEach(control => {
            if (control === except) return;
            control.classList.remove("is-open");
            const trigger = control.querySelector(".hub-account__avatar");
            const menu = control.querySelector(".hub-account__menu");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
            if (menu) menu.hidden = true;
        });
    }

    function buildAccountControl() {
        const control = document.createElement("div");
        control.className = "hub-account";
        const user = readUser();

        if (!user) {
            const login = document.createElement("a");
            login.className = "hub-account__login";
            login.href = "login.html";
            login.setAttribute("aria-label", "Sign in");
            login.title = "Sign in";
            login.innerHTML = siteIcon("login");
            control.appendChild(login);
            return control;
        }

        const displayName = String(user.name || user.email || "Account").trim() || "Account";
        const menuId = "hubAccountMenu" + Math.random().toString(36).slice(2, 8);
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "hub-account__avatar";
        trigger.textContent = (displayName.charAt(0) || "A").toUpperCase();
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", menuId);
        trigger.setAttribute("aria-label", "Account menu for " + displayName);
        trigger.title = displayName;

        const menu = document.createElement("div");
        menu.className = "hub-account__menu";
        menu.id = menuId;
        menu.setAttribute("role", "menu");
        menu.hidden = true;

        const who = document.createElement("div");
        who.className = "hub-account__who";
        const whoName = document.createElement("strong");
        whoName.textContent = displayName;
        who.appendChild(whoName);
        if (user.email && user.email !== displayName) {
            const whoMail = document.createElement("span");
            whoMail.textContent = user.email;
            who.appendChild(whoMail);
        }
        menu.appendChild(who);

        if (isAdminUser(user)) {
            const dash = document.createElement("a");
            dash.href = "admin.html";
            dash.setAttribute("role", "menuitem");
            dash.innerHTML = siteIcon("dashboard") + "<span>Dashboard</span>";
            menu.appendChild(dash);
        }

        const out = document.createElement("button");
        out.type = "button";
        out.className = "hub-account__signout";
        out.setAttribute("role", "menuitem");
        out.innerHTML = siteIcon("logout") + "<span>Sign out</span>";
        out.addEventListener("click", signOut);
        menu.appendChild(out);

        function setOpen(open) {
            closeAccountMenus(control);
            control.classList.toggle("is-open", open);
            trigger.setAttribute("aria-expanded", String(open));
            menu.hidden = !open;
            if (open) {
                const first = menu.querySelector("[role='menuitem']");
                if (first) first.focus({ preventScroll: true });
            }
        }

        trigger.addEventListener("click", event => {
            event.stopPropagation();
            setOpen(!control.classList.contains("is-open"));
        });
        control.addEventListener("keydown", event => {
            if (event.key === "Escape" && control.classList.contains("is-open")) {
                setOpen(false);
                trigger.focus();
            } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && control.classList.contains("is-open")) {
                const items = Array.from(menu.querySelectorAll("[role='menuitem']"));
                const index = items.indexOf(document.activeElement);
                const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                event.preventDefault();
                items[next].focus();
            }
        });

        control.append(trigger, menu);
        return control;
    }

    function mountHeaderAccount() {
        // Pages with the products.js auth block keep their original nodes (used by handleUserState),
        // but the visible control is the shared avatar / sign-in icon.
        document.querySelectorAll("#authContainer").forEach(container => {
            container.classList.add("has-hub-account");
            const old = container.querySelector(":scope > .hub-account");
            if (old) old.remove();
            container.appendChild(buildAccountControl());
        });

        // Other headers expose a plain account link; swap it for the same control.
        document.querySelectorAll("header a[href='account.html'], header a[href='login.html'], header .hub-account[data-hub-account-slot]").forEach(node => {
            if (node.closest("#authContainer")) return;
            const control = buildAccountControl();
            control.setAttribute("data-hub-account-slot", "");
            node.replaceWith(control);
        });
    }

    document.addEventListener("click", event => {
        if (!event.target.closest(".hub-account")) closeAccountMenus();
    });

    function mountMenu() {
        mountHeaderAccount();
        if (document.getElementById("siteMenu")) return;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `
            <button class="site-menu-backdrop" id="siteMenuBackdrop" type="button" aria-label="Close navigation menu" tabindex="-1"></button>
            <aside class="site-menu" id="siteMenu" role="dialog" aria-modal="true" aria-label="Arduino Hub navigation" aria-hidden="true" inert>
                <div class="site-menu__header">
                    <a class="site-menu__brand" href="index.html" aria-label="Arduino Hub home"><img src="assets/arduino-hub-logo.png" alt="Arduino Hub"></a>
                    <button class="site-menu__close" type="button" id="siteMenuClose" aria-label="Close menu">${siteIcon("close")}</button>
                </div>
                <a class="site-menu__account" id="siteMenuAccountLink" href="login.html">
                    <span class="site-menu__avatar" id="siteMenuAccountAvatar">${siteIcon("user")}</span>
                    <span class="site-menu__account-copy"><strong id="siteMenuAccountName">Guest</strong><span id="siteMenuAccountDetail">Login or Create Account</span></span>
                    <span class="site-menu__account-arrow" id="siteMenuAccountChevron">${siteIcon("chevronRight")}</span>
                    <button type="button" class="site-menu__logout-btn" id="siteMenuLogoutBtn" aria-label="Log out" title="Log out" hidden>${siteIcon("logout")}</button>
                </a>
                <nav class="site-menu__links" aria-label="Main navigation">
                    <a href="index.html">${siteIcon("home")}<span>Home</span></a>
                    <a href="shop.html">${siteIcon("store")}<span>All Products</span></a>
                    <details class="site-menu__category-group">
                        <summary>${siteIcon("grid")}<span>Categories</span>${siteIcon("chevronDown")}</summary>
                        <div class="site-menu__category-links" id="siteCategoryLinks"><a class="site-menu__category-all" href="shop.html#categories">${siteIcon("arrowRight")}<span>Browse all categories</span></a></div>
                    </details>
                    <a href="checkout.html" data-cart-nav>${siteIcon("cart")}<span>Shopping Cart</span><span class="site-menu__cart-count" id="siteMenuCartCount">0</span></a>
                    <a href="index.html#footer">${siteIcon("info")}<span>About Us</span></a>
                </nav>
                <div class="site-menu__secondary" aria-label="More information">
                    <a href="index.html#footer">Services</a>
                    <a href="index.html#footer">Supports</a>
                    <a href="index.html#footer">FAQ</a>
                    <a href="index.html#footer">Terms &amp; Conditions</a>
                    <a href="index.html#footer">Privacy Policy</a>
                </div>
                <div class="site-menu__socials" aria-label="Social media">
                    <a href="https://www.instagram.com/arduinohub1" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
                    <a href="https://www.tiktok.com/@arduino.hub0" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>
                </div>
                <div class="site-menu__contact">
                    <strong>Contact Us</strong>
                    <a href="tel:+201157992296"><i class="fa-solid fa-phone" aria-hidden="true"></i><span>+20 01157992296</span></a>
                    <a href="mailto:arduinohub1@gmail.com"><i class="fa-solid fa-envelope" aria-hidden="true"></i><span>arduinohub1@gmail.com</span></a>
                </div>
            </aside>`;
        document.body.appendChild(wrapper);

        const menu = document.getElementById("siteMenu");
        const backdrop = document.getElementById("siteMenuBackdrop");
        const closeButton = document.getElementById("siteMenuClose");
        const accountLink = document.getElementById("siteMenuAccountLink");
        const accountChevron = document.getElementById("siteMenuAccountChevron");
        const logoutBtn = document.getElementById("siteMenuLogoutBtn");
        const triggers = document.querySelectorAll("[data-site-menu-open]");
        let previousFocus = null;

        if (logoutBtn) {
            logoutBtn.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                signOut();
            });
        }
        if (accountLink) {
            accountLink.addEventListener("click", event => {
                const user = readUser();
                if (!user) return;
                event.preventDefault();
                event.stopPropagation();
                const showLogout = accountLink.classList.toggle("show-logout");
                if (logoutBtn) logoutBtn.hidden = !showLogout;
                if (accountChevron) accountChevron.hidden = showLogout;
            });
        }

        function closeMenu() {
            menu.classList.remove("is-open");
            backdrop.classList.remove("is-open");
            menu.setAttribute("aria-hidden", "true");
            menu.inert = true;
            document.body.classList.remove("site-menu-open");
            triggers.forEach(button => {
                button.setAttribute("aria-expanded", "false");
                button.setAttribute("aria-label", "Open menu");
            });
            if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
        }

        function openMenu(trigger) {
            previousFocus = trigger || document.activeElement;
            menu.inert = false;
            menu.classList.add("is-open");
            backdrop.classList.add("is-open");
            menu.setAttribute("aria-hidden", "false");
            document.body.classList.add("site-menu-open");
            triggers.forEach(button => {
                button.setAttribute("aria-expanded", "true");
                button.setAttribute("aria-label", "Close menu");
            });
            closeButton.focus();
            refreshAccountLink();
            refreshCartCount();
        }

        triggers.forEach(button => {
            const oldIcon = button.querySelector("i");
            if (oldIcon) oldIcon.outerHTML = siteIcon("menu");
            button.setAttribute("aria-controls", "siteMenu");
            button.setAttribute("aria-expanded", "false");
            button.addEventListener("click", () => openMenu(button));
        });
        closeButton.addEventListener("click", closeMenu);
        backdrop.addEventListener("click", closeMenu);
        menu.addEventListener("click", event => {
            const link = event.target.closest("a");
            if (link && !(link.id === "siteMenuAccountLink" && readUser())) closeMenu();
        });
        document.addEventListener("keydown", event => { if (event.key === "Escape" && menu.classList.contains("is-open")) closeMenu(); });
        menu.addEventListener("keydown", event => {
            if (event.key !== "Tab") return;
            const items = Array.from(menu.querySelectorAll('a[href], button:not(:disabled), summary'));
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });

        window.openSiteMenu = openMenu;
        window.closeSiteMenu = closeMenu;
        refreshAccountLink();
        refreshCartCount();
        window.addEventListener("storage", event => {
            if (!event.key || event.key === USER_KEY) { refreshAccountLink(); mountHeaderAccount(); }
            if (!event.key || event.key === CART_KEY) refreshCartCount();
        });
        window.addEventListener("arduino-hub:user-changed", () => { refreshAccountLink(); mountHeaderAccount(); });
        window.addEventListener("arduino-hub:cart-changed", refreshCartCount);
        window.addEventListener("arduino-hub:categories-ready", event => renderCategoryLinks(event.detail && event.detail.categories));
        document.addEventListener("click", event => {
            const assistantLink = event.target.closest("[data-ai-chat-open]");
            if (assistantLink && typeof window._aicbToggle === "function") {
                event.preventDefault();
                closeMenu();
                window._aicbToggle(true);
                return;
            }
            const cartLink = event.target.closest("[data-cart-nav]");
            if (!cartLink || typeof window.toggleCart !== "function") return;
            event.preventDefault();
            window.toggleCart(true);
            refreshCartCount();
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountMenu, { once: true });
    else mountMenu();
})();
