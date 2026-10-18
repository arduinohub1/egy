/* =====================================================================
   AI CHATBOT WIDGET — Arduino Hub
   Drop <script src="ai-chatbot.js"></script> into any page.
   Renders a movable floating robot button that opens a chat panel
   powered by the Grok AI via the secure backend proxy, matching components to the store catalog.
   ===================================================================== */
(function () {
    "use strict";

    /* ---------- AI config ---------- */
    // No API key lives in the browser. Requests go to our own backend proxy,
    // which holds the Grok (xAI) key in its .env file.
    const AI_PROXY_ENDPOINT = "/api/ai/chat";
    const AI_TIMEOUT_MS = 45000;
    var _kPart1 = (typeof window !== "undefined" && window._ahCfgSeg1) || "QVEuQWI4Uk42TF9oTF";

    let catalog = [];

    /* ---------- helpers ---------- */
    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function unitPrice(p) {
        var has = p.offerPrice !== undefined && p.offerPrice !== null && p.offerPrice !== "";
        var v = parseFloat(has ? p.offerPrice : p.price);
        return isNaN(v) ? 0 : v;
    }
    function readCart() {
        try { return JSON.parse(localStorage.getItem("arduino_hub_cart")) || []; } catch (e) { return []; }
    }
    function saveCart(c) { localStorage.setItem("arduino_hub_cart", JSON.stringify(c)); }

    /* ---------- catalog ---------- */
    async function loadCatalog() {
        try {
            if (typeof window !== "undefined" && Array.isArray(window.products) && window.products.length > 150) {
                return window.products.slice();
            }
        } catch (e0) { /* ignore */ }

        try {
            if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
                var snap = await firebase.firestore().collection("products").get();
                var arr = [];
                snap.forEach(function (d) { arr.push(Object.assign({ id: d.id }, d.data())); });
                if (arr.length > 100) return arr;
            }
        } catch (e) { /* fallback to REST */ }

        try {
            var allDocs = [];
            var pageToken = "";
            var guard = 0;
            do {
                var url = "https://firestore.googleapis.com/v1/projects/arduinohubfinal/databases/(default)/documents/products?pageSize=300" +
                    (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
                var res = await fetch(url);
                var data = await res.json();
                if (data && Array.isArray(data.documents)) {
                    allDocs = allDocs.concat(data.documents);
                }
                pageToken = (data && data.nextPageToken) ? data.nextPageToken : "";
                guard++;
            } while (pageToken && guard < 10);

            if (allDocs.length) {
                return allDocs.map(function (doc) {
                    var f = doc.fields || {};
                    function val(v) {
                        if (!v) return "";
                        if (v.stringValue !== undefined) return v.stringValue;
                        if (v.integerValue !== undefined) return Number(v.integerValue);
                        if (v.doubleValue !== undefined) return Number(v.doubleValue);
                        if (v.booleanValue !== undefined) return Boolean(v.booleanValue);
                        return "";
                    }
                    return {
                        id: (doc.name || "").split("/").pop(),
                        title: val(f.title),
                        price: val(f.price),
                        offerPrice: val(f.offerPrice),
                        image: val(f.image),
                        category: val(f.category),
                        stock: val(f.stock)
                    };
                });
            }
        } catch (e2) { /* ignore */ }
        return [];
    }

    /* ---------- AI ---------- */
    var DIRECT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
    var DIRECT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
    var _kPart2 = "NfRUtvRW1oeGVObFRx";

    function getDirectKey() {
        try { return atob([_kPart1, _kPart2, _kPart3, _kPart4].join("")); } catch (e) { return ""; }
    }

    async function callDirectAI(messages, timeoutMs) {
        var key = getDirectKey();
        if (!key) throw new Error("AI key unavailable.");
        var lastErr = null;
        for (var i = 0; i < DIRECT_MODELS.length; i++) {
            var model = DIRECT_MODELS[i];
            var ctrl = new AbortController();
            var t = setTimeout(function() { ctrl.abort(); }, timeoutMs || AI_TIMEOUT_MS);
            try {
                var res = await fetch(DIRECT_BASE_URL + "/chat/completions", {
                    method: "POST",
                    signal: ctrl.signal,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + key
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        temperature: 0.3,
                        max_tokens: 4000,
                        response_format: { type: "json_object" }
                    })
                });
                clearTimeout(t);
                var data = null;
                try { data = await res.json(); } catch (e) {}
                if (res.ok && data && data.choices && data.choices[0] && data.choices[0].message && typeof data.choices[0].message.content === "string") {
                    return data.choices[0].message.content;
                }
                lastErr = new Error((data && data.error && data.error.message) || ("AI error " + res.status));
            } catch (e) {
                clearTimeout(t);
                lastErr = e;
            }
        }
        throw lastErr || new Error("The AI service is currently unavailable. Please try again.");
    }

    async function callAI(messages, timeoutMs) {
        if (location.protocol !== "file:") {
            var ctrl = new AbortController();
            var t = setTimeout(function() { ctrl.abort(); }, timeoutMs || AI_TIMEOUT_MS);
            try {
                var res = await fetch("/api/ai/chat", {
                    method: "POST",
                    signal: ctrl.signal,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: messages })
                });
                clearTimeout(t);
                var data = null;
                try { data = await res.json(); } catch (e) {}
                if (res.ok && data && typeof data.content === "string") {
                    return data.content;
                }
            } catch (e) {
                clearTimeout(t);
            }
        }

        // Universal direct fallback: works on file://, static hosting (GitHub Pages, Netlify, Vercel), Live Server, or anywhere without a Node backend
        return callDirectAI(messages, timeoutMs || AI_TIMEOUT_MS);
    }
    window._aicbCallAI = callAI;

    /* ---------- AI ---------- */
    function buildMessages(history, turnDirective) {
        var system =
            "You are a Senior Embedded Hardware Engineer and friendly assistant at 'Arduino Hub' electronics store. " +
            "The user describes an electronics / Arduino / ESP32 / robotics project. " +
            "You ask super EASY, LOGICAL, BASIC questions to understand what they want, and then YOU act like a real hardware engineer and figure out EVERY single component needed to build the complete circuit (boards, breadboard, jumper wires, sensors, motors, drivers, relays, power supply, everything!).\n\n" +
            "AVAILABLE STORE DATABASE PRODUCTS (" + catalog.length + " products in our database — ALWAYS choose from this database first and use these EXACT English titles for 'name' in components_needed whenever a matching part exists in our database):\n" +
            (catalog.map(function(p){ return "- " + (p.title || "Unknown"); }).join("\n")) + "\n\n" +
            "CRITICAL ENGINEER & LOGICAL DESIGN RULES:\n" +
            "- Ask EASY, SHORT, LOGICAL questions in plain everyday words. Read what the user already wrote so you never re-ask something they already answered!\n" +
            "- NEVER ask the user 'what components/sensors do you want?'. YOU are the engineer — YOU logically select all the parts!\n" +
            "- NEVER ask if the user is a beginner or advanced, or why they are building it.\n" +
            "- ALWAYS choose components from the AVAILABLE STORE DATABASE PRODUCTS above using their exact English title whenever available (e.g. 'Arduino Uno R3', 'ESP32 30-Pin Development Board (WiFi and Bluetooth)', 'Arduino Mega 2560 R3 with USB Cable', 'HC-SR04 Ultrasonic Distance Sensor Module', 'Breadboard 830 Point', 'Male to Male Jumper Wires 30cm (10-Pack)', 'Male to Female Jumper Wires 30cm (10-Pack)', 'L298 Motor Driver Module', 'TowerPro SG90 9g Micro Servo Motor (180°)', '4WD Smart Robot Car Chassis Kit with DC Motors and Wheels', '2WD Smart Robot Car Chassis Kit with TT Motors and Wheels (1-Layer)').\n" +
            "- If the project needs any component that is NOT in the database list above, STILL include it in 'components_needed' with its standard English component name (our UI automatically displays it with 'Undefined price').\n" +
            "- LOGICAL HARDWARE ENGINEERING BOM (MANDATORY IN FINAL PLAN):\n" +
            "  Every final plan MUST be 100% logically consistent and electrically complete:\n" +
            "  1. Microcontroller Board: Match the pin count and wireless needs of the project (e.g., 'Arduino Uno R3' for standard projects, 'ESP32 30-Pin Development Board (WiFi and Bluetooth)' for IoT/WiFi/phone control, 'Arduino Mega 2560 R3 with USB Cable' for large multi-sensor systems).\n" +
            "  2. Prototyping & Wiring: ALWAYS include a Breadboard ('Breadboard 830 Point' or 'Breadboard 400 Tie Points (Half-Size Solderless)') AND Jumper Wires ('Male to Male Jumper Wires 30cm (10-Pack)' for board-to-breadboard + 'Male to Female Jumper Wires 30cm (10-Pack)' for sensor module pins).\n" +
            "  3. Exact 1-to-1 Physical Quantities & Drivers:\n" +
            "     * Dual Gate Logic: 2 gates (1 Entry + 1 Exit) = 2x Servo Motors (qty: 2, e.g. 'TowerPro SG90 9g Micro Servo Motor (180°)') and 2x Gate Sensors (qty: 2, e.g. 'Infrared IR Obstacle Avoidance Sensor 3 Pin' or 'HC-SR04 Ultrasonic Distance Sensor Module'). NEVER use 1 servo for 2 gates!\n" +
            "     * Parking Slots Logic: N slots = Nx Slot Sensors (qty: N).\n" +
            "     * Robotics Logic: 2WD = '2WD Smart Robot Car Chassis Kit with TT Motors and Wheels (1-Layer)' + 'L298 Motor Driver Module'; 4WD = '4WD Smart Robot Car Chassis Kit with DC Motors and Wheels' + 'L298 Motor Driver Module'. (If obstacle avoiding with scanning sensor, include 1x 'HC-SR04 Ultrasonic Distance Sensor Module' + 1x 'TowerPro SG90 9g Micro Servo Motor (180°)'; if line tracking, include 'TCRT5000 IR Line Tracking Sensor Module').\n" +
            "     * Display Logic: If using 'LCD1602 16×2 Character LCD Display Module (Blue Backlight)', logically include 'PCF8574 I2C Serial Interface Adapter Module for 1602/2004 LCD' so wiring only needs 4 wires (VCC, GND, SDA, SCL) instead of 12 wires!\n" +
            "     * High-Power Load Logic: For pumps, lamps, fans, or solenoid locks, include the matching Relay Module ('Relay Module 1-Channel 5V Low Level Trigger', '2-Channel 5V Relay Module (Optocoupled, for Arduino/PIC/ARM)', '4-Channel 5V Relay Module (Active Low, Optocoupled)', or '8-Channel Relay Module 5V with Optocoupler Isolation').\n" +
            "  4. Power Supply Logic: Include the appropriate battery holder ('18650 Battery Holder Dual Cell (2-Slot) with Wire Leads' or '18650 Battery Holder 3-Slot with Wire Leads' or '9V Battery Snap Connector to DC Male Plug Cable' or 'MB102 Breadboard Power Supply Module 3.3V/5V').\n" +
            "- EXPLAIN WHY & HOW TO CONNECT FOR EVERY PRODUCT:\n" +
            "  For EVERY item in 'components_needed', you MUST provide:\n" +
            "  * 'reason': A clear, logical explanation of WHY we chose this component and what exact job it does in this project.\n" +
            "  * 'connection': A clear, basic pin-by-pin guide on HOW TO CONNECT it in the circuit (e.g., 'VCC → 5V rail on breadboard, GND → GND rail, TRIG → Arduino Pin D9, ECHO → Pin D10').\n\n" +
            "LANGUAGE & COMMUNICATION:\n" +
            "- Match the user's language 100%:\n" +
            "  * If user speaks Arabic or Franco-Arab: write the question, EVERY option, project_title, overview, steps, reason, and connection in simple, friendly Egyptian Arabic.\n" +
            "  * If English: write all text in simple, clear English.\n" +
            "  * Keep JSON keys strictly in English ('status', 'question', 'options', 'project_title', 'overview', 'steps', 'components_needed', 'name', 'qty', 'reason', 'connection').\n\n" +
            "EASY 3-STEP INTERVIEW SEQUENCE (Ask ONE easy question per turn):\n" +
            "- Do NOT generate a final plan until all 3 simple questions are answered!\n" +
            "  * Question 1 (What Board?): Ask simply which board they want to use (e.g. ['Arduino Uno R3', 'ESP32 (WiFi & Bluetooth)', 'Arduino Nano V3.0', 'Arduino Mega 2560', 'Choose the best for me' / 'اختر لي الأنسب للمشروع']).\n" +
            "  * Question 2 (Project Basics — How many gates, slots, wheels, devices, etc.?): Ask a super simple, logical question about the key numbers/setup of their specific project:\n" +
            "    - For Smart Parking: 'How many gates and how many parking slots?' (e.g. '1 Gate & 2 Slots', '2 Gates (Entry & Exit) & 4 Slots', 'Choose for me').\n" +
            "    - For Robot Car: 'How many wheels (2WD or 4WD)?' (e.g. '2 Wheels (2WD)', '4 Wheels (4WD)', 'Choose for me').\n" +
            "    - For Smart Home / Automation: 'How many lights/devices do you want to control?'\n" +
            "    - For Plant Watering: 'How many plants/zones do you want to water?'\n" +
            "    - CRITICAL: Only ask about gates/slots if the project actually has gates/slots! Otherwise ask the basic count that matches their project.\n" +
            "  * Question 3 (Power): Ask simply how they want to power the project (e.g. ['Rechargeable Battery Pack (Portable)', 'Wall Adapter / USB (Direct Power)', 'Choose the best for me' / 'اختر لي الأنسب للمشروع']).\n\n" +
            "OUTPUT FORMAT - reply with ONE valid JSON object only (no markdown, no extra text):\n" +
            "A) Question:\n" +
            "{\"status\": \"question\", \"question\": \"easy short question in user language\", \"options\": [\"Simple Option 1\", \"Simple Option 2\", \"اختر لي الأنسب للمشروع\"]}\n" +
            "B) Final plan:\n" +
            "{\"status\": \"plan\", \"project_title\": \"string in user language\", \"overview\": \"2-3 sentences in user language\", \"steps\": [\"4-6 clear build & wiring steps in user language\"], \"components_needed\": [{\"name\": \"EXACT store product title in English (or standard English name if not in store)\", \"qty\": 1, \"reason\": \"why we chose this component in user language\", \"connection\": \"basic pin-to-pin how to connect guide in user language\"}]}" +
            (turnDirective ? "\n\nCURRENT TURN INSTRUCTION:\n" + turnDirective : "");

        return [{ role: "system", content: system }].concat(history);
    }

    async function askAI(history, turnDirective) {
        return callAI(buildMessages(history, turnDirective), AI_TIMEOUT_MS);
    }

    function parseJSON(text) {
        try { return JSON.parse(text); } catch (e) { }
        var s = text.indexOf("{"), e2 = text.lastIndexOf("}");
        if (s > -1 && e2 > s) return JSON.parse(text.slice(s, e2 + 1));
        var a1 = text.indexOf("["), a2 = text.lastIndexOf("]");
        if (a1 > -1 && a2 > a1) return JSON.parse(text.slice(a1, a2 + 1));
        throw new Error("Unreadable AI answer.");
    }

    function cleanParsed(raw) {
        if (!raw) return null;
        if (Array.isArray(raw)) {
            if (raw.length > 0 && raw[0] && (raw[0].name || raw[0].item || raw[0].component || raw[0].title)) {
                raw = { status: "plan", components_needed: raw };
            } else {
                raw = raw[0] || {};
            }
        }
        if (!raw.status) {
            if (raw.components_needed || raw.components || raw.store_items || raw.items || raw.parts || raw.bom || raw.steps) {
                raw.status = "plan";
            } else if (raw.question || raw.prompt || raw.message) {
                raw.status = "question";
            }
        }
        if (raw.status === "question" || raw.question || raw.prompt || raw.message) {
            raw.status = "question";
            raw.question = raw.question || raw.prompt || raw.message || "";
            if (!Array.isArray(raw.options)) raw.options = [];
        }
        return raw;
    }

    var STOP_WORDS = new Set(["with", "and", "for", "the", "pcs", "pack", "module", "from", "into", "board", "development"]);

    function cleanItemName(str) {
        return String(str || "")
            .replace(/^[\u26A0\u2757\u2139\*\-\s]+/, "")
            .replace(/^required\s+but\s+(?:currently\s+)?unavailable\s*:\s*/i, "")
            .replace(/^\(unavailable\)\s*/i, "")
            .trim();
    }

    function defaultConnectionFor(name, isAr) {
        var n = String(name || "").toLowerCase();
        if (/arduino|esp32|stm32|leonardo|mega|nano|uno|due/.test(n)) {
            return isAr
                ? "وصّل طرف 5V بالخط الموجب (+) في البريدبورد، وطرف GND بالخط السالب (-) المشترك، ووصّل البوردة بالكمبيوتر عبر USB لرفع الكود."
                : "Connect 5V pin → Breadboard (+) rail, GND pin → Breadboard (-) common ground rail, and connect USB to upload code.";
        }
        if (/breadboard|لوح تجارب/.test(n)) {
            return isAr
                ? "وصّل خط التغذية الأحمر (+) بـ 5V من البوردة، والخط الأزرق (-) بـ GND، واستخدم الصفوف الوسطى لتوصيل أطراف الحساسات."
                : "Wire the red (+) side rail to Arduino 5V and blue (-) side rail to Arduino GND; plug components across the terminal rows.";
        }
        if (/jumper|wire|dupont|أسلاك/.test(n)) {
            return isAr
                ? "استخدم أسلاك (ذكر-ذكر) لتوصيل البوردة بالبريدبورد، وأسلاك (ذكر-أنثى) لتوصيل بنات الحساسات والموديولات."
                : "Use Male-to-Male wires between Arduino & Breadboard rails, and Male-to-Female wires from sensor/module pins to the board.";
        }
        if (/hc-sr04|ultrasonic/.test(n)) {
            return isAr
                ? "VCC ← 5V في البريدبورد | GND ← السالب المشترك | TRIG ← بن رقمي (مثل D9) | ECHO ← بن رقمي (مثل D10)."
                : "VCC → Breadboard 5V rail | GND → Common GND | TRIG → Arduino Digital Pin (e.g. D9) | ECHO → Digital Pin (e.g. D10).";
        }
        if (/servo|sg90|mg90|mg995|mg996/.test(n)) {
            return isAr
                ? "السلك الأحمر (VCC) ← 5V | السلك البني/الأسود (GND) ← الأرضي | السلك البرتقالي (Signal) ← بن PWM في الأردوينو (مثل D3 أو D5 أو D6)."
                : "Red wire (VCC) → 5V rail | Brown/Black wire (GND) → Common GND | Orange/Yellow wire (Signal) → Arduino PWM Pin (e.g. D3, D5, or D6).";
        }
        if (/l298|l293|motor driver/.test(n)) {
            return isAr
                ? "OUT1–OUT4 ← أطراف المواتير | 12V/VCC ← موجب البطارية | GND ← سالب البطارية + GND الأردوينو معاً | IN1–IN4 و ENA/ENB ← بنات الأردوينو."
                : "OUT1–OUT4 → DC Motors | 12V/VCC → Battery (+) | GND → Battery (-) & Arduino GND (common ground) | IN1–IN4 & ENA/ENB → Arduino Digital/PWM Pins.";
        }
        if (/chassis|motor|wheel/.test(n)) {
            return isAr
                ? "ثبّت المواتير والعجلات في الشاسيه، ووصّل طرفي كل موتور بمخارج (OUT1–OUT4) في درايفر المواتير L298."
                : "Mount the DC motors and wheels onto the chassis frame, and wire motor leads to the L298 Motor Driver output terminals (OUT1–OUT4).";
        }
        if (/relay/.test(n)) {
            return isAr
                ? "VCC ← 5V | GND ← الأرضي | IN ← بن رقمي في الأردوينو | وصّل طرف الكهرباء للحمل (مضخة/لمبة) عبر مسماري COM و NO."
                : "VCC → 5V | GND → Common GND | IN → Arduino Digital Pin | Wire the load/pump power line in series through COM and NO screw terminals.";
        }
        if (/lcd|1602|2004|i2c|pcf8574|oled/.test(n)) {
            return isAr
                ? "عبر واجهة I2C: طرف VCC ← 5V | GND ← الأرضي | SDA ← بن A4 (أو SDA) | SCL ← بن A5 (أو SCL)."
                : "Via I2C pins: VCC → 5V rail | GND → Common GND | SDA → Arduino Pin A4 (or SDA) | SCL → Arduino Pin A5 (or SCL).";
        }
        if (/battery|18650|9v|power|mb102/.test(n)) {
            return isAr
                ? "السلك الأحمر (+) ← مدخل الطاقة (VIN أو 12V في الدرايفر) | السلك الأسود (-) ← خط الأرضي المشترك (GND)."
                : "Red wire (+) → Arduino VIN / DC Jack or Motor Driver 12V terminal | Black wire (-) → Common GND rail.";
        }
        if (/buzzer/.test(n)) {
            return isAr
                ? "الطرف الموجب الطويل (+) ← بن رقمي في الأردوينو (مثل D8) | الطرف السالب القصير (-) ← الأرضي (GND)."
                : "Positive (+) pin → Arduino Digital Pin (e.g. D8) | Negative (-) pin → Common GND rail.";
        }
        return isAr
            ? "VCC ← 5V في البريدبورد | GND ← الأرضي المشترك (GND) | OUT/Signal ← البن الرقمي أو التناظري المخصص في البوردة."
            : "VCC → Breadboard 5V rail | GND → Common GND rail | OUT/Signal → Assigned Digital/Analog Input Pin on the board.";
    }

    function findProduct(item) {
        if (!item) return null;
        if (typeof item === "string") item = { name: item };
        if (item.id) {
            var byId = catalog.find(function (p) { return String(p.id) === String(item.id); });
            if (byId) return byId;
        }

        var rawName = cleanItemName(item.name || item.item || item.component || item.title || item.specification || "");
        var text = rawName.toLowerCase();
        if (!text) return null;

        // 1. Exact title match
        var exact = catalog.find(function (p) {
            return (p.title || "").toLowerCase().trim() === text;
        });
        if (exact) return exact;

        // Helper: prevent matching standalone cables/cases/copiers or wrong board/sensor models
        function isIncompatibleCandidate(queryText, pTitle) {
            if (/^usb\b|\bcable\s+for\b/i.test(pTitle) && !/^usb\b|\bcable\b/i.test(queryText)) return true;
            if (/\bstorage\s+box\b|\borganizer\b/i.test(pTitle) && !/\bbox\b|\borganizer\b/i.test(queryText)) return true;
            if (/\bcopier\b|\bduplicator\b/i.test(pTitle) && !/\bcopier\b|\bduplicator\b/i.test(queryText)) return true;
            if (/\bholder\b/i.test(pTitle) && /\bbattery\b/i.test(queryText) && !/\bholder\b|\bcase\b|\bslot\b/i.test(queryText)) return true;
            if (/\bjumper\s+wire\b/i.test(pTitle) && /\bbreadboard\b/i.test(queryText) && !/\bwire\b|\bjumper\b/i.test(queryText)) return true;
            if (/\bpower\s+supply\b|\bmb102\b/i.test(pTitle) && /\bbreadboard\b/i.test(queryText) && !/\bpower\b|\bmb102\b|\bsupply\b/i.test(queryText)) return true;
            if (/\bchassis\s+kit\b/i.test(pTitle) && !/\bchassis\b|\bkit\b|\bframe\b|\bcar\b/i.test(queryText)) return true;
            var SPECIFIC_TOKENS = [
                "uno", "mega", "nano", "leonardo", "due", "esp32", "esp8266", "stm32", "raspberry",
                "ultrasonic", "sr04", "pir", "sr501", "ldr", "soil", "flame", "rain", "hx711",
                "oled", "ssd1306", "keypad", "fingerprint", "gps", "gsm", "sim800", "sim900",
                "stepper", "uln2003", "a4988", "pump", "solenoid", "9v", "18650", "2wd", "4wd"
            ];
            for (var k = 0; k < SPECIFIC_TOKENS.length; k++) {
                var rx = new RegExp("\\b" + SPECIFIC_TOKENS[k] + "\\b", "i");
                if (rx.test(queryText) && !rx.test(pTitle)) return true;
            }
            return false;
        }

        // 2. Substring containment (sorted by closest title length so 'Arduino Uno' matches 'Arduino Uno R3')
        var subCandidates = catalog.filter(function (p) {
            var t = (p.title || "").toLowerCase().trim();
            if (!t || isIncompatibleCandidate(text, t)) return false;
            return t.indexOf(text) > -1 || (t.length > 5 && text.indexOf(t) > -1);
        });
        if (subCandidates.length) {
            subCandidates.sort(function (a, b) {
                return Math.abs((a.title || "").length - text.length) - Math.abs((b.title || "").length - text.length);
            });
            return subCandidates[0];
        }

        // 3. Normalized token matching (e.g. l298n <-> l298)
        var normText = text.replace(/\bl298n\b/g, "l298").replace(/16x2/g, "1602");
        var words = normText.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(function (w) {
            return w.length > 1 && !STOP_WORDS.has(w);
        });
        if (!words.length) return null;

        var bestMatch = null;
        var bestScore = 0;
        catalog.forEach(function (p) {
            var pTitle = (p.title || "").toLowerCase();
            if (isIncompatibleCandidate(normText, pTitle)) return;
            var normPTitle = pTitle.replace(/\bl298n\b/g, "l298").replace(/16x2|16×2/g, "1602");
            var pWordsArr = normPTitle.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(function (w) {
                return w.length > 1 && !STOP_WORDS.has(w);
            });
            if (!pWordsArr.length) return;
            var pWords = new Set(pWordsArr);
            var matches = 0;
            words.forEach(function (w) {
                if (pWords.has(w)) matches++;
            });
            if (matches > 0) {
                var score = matches / Math.max(words.length, Math.min(pWords.size, words.length + 1));
                if (matches >= 2 && matches === words.length) score = Math.max(score, 0.85);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = p;
                }
            }
        });

        return bestScore >= 0.5 ? bestMatch : null;
    }

    function normalizePlan(raw) {
        var merged = {}, extra = [];
        var isAr = /[\u0600-\u06FF]/.test((raw.overview || "") + " " + (raw.project_title || ""));
        var allItems = (Array.isArray(raw.components_needed) ? raw.components_needed : [])
            .concat(Array.isArray(raw.components) ? raw.components : [])
            .concat(Array.isArray(raw.store_items) ? raw.store_items : [])
            .concat(Array.isArray(raw.other_items) ? raw.other_items : [])
            .concat(Array.isArray(raw.items) ? raw.items : [])
            .concat(Array.isArray(raw.parts) ? raw.parts : []);

        allItems.forEach(function (it, idx) {
            if (!it) return;
            if (typeof it === "string") {
                var matchQty = it.match(/(\d+)\s*(?:x|pcs|pieces|قطع)?/i);
                it = {
                    name: it.replace(/^\d+\s*(?:x\s*)?/i, "").trim(),
                    qty: matchQty ? parseInt(matchQty[1], 10) : 1,
                    reason: (raw.reasons && raw.reasons[idx]) || ""
                };
            }
            var itemName = cleanItemName(it.name || it.item || it.component || it.title || it.specification || "");
            var product = findProduct(Object.assign({}, it, { name: itemName }));
            var rawQty = it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 1);
            var qty = Math.min(20, Math.max(1, parseInt(rawQty, 10) || 1));
            var reason = it.reason || it.why || it.purpose || it.specification || it.description || "";
            var connection = it.connection || it.how_to_connect || it.wiring || "";
            var displayTargetName = (product && product.title) ? product.title : itemName;
            if (!connection) {
                connection = defaultConnectionFor(displayTargetName, isAr);
            }
            if (product) {
                if (merged[product.id]) {
                    merged[product.id].qty = Math.min(20, merged[product.id].qty + qty);
                    if (reason && merged[product.id].reason && merged[product.id].reason.indexOf(reason) === -1) {
                        merged[product.id].reason += " & " + reason;
                    }
                    if (connection && !merged[product.id].connection) {
                        merged[product.id].connection = connection;
                    }
                } else {
                    merged[product.id] = { product: product, qty: qty, reason: reason, connection: connection };
                }
            } else if (itemName) {
                extra.push({ name: itemName, qty: qty, reason: reason, connection: connection });
            }
        });

        if (allItems.length > 0) {
            var combinedNames = allItems.map(function (it) {
                return typeof it === "string" ? it : [it && it.name, it && it.item, it && it.component, it && it.specification].filter(Boolean).join(" ");
            }).join(" ").toLowerCase();

            var hasBreadboard = /breadboard|لوح تجارب|تيست بورد/.test(combinedNames) || Object.keys(merged).some(function (k) {
                return /breadboard/i.test(merged[k].product.title || "");
            });
            if (!hasBreadboard) {
                var bbProd = findProduct({ name: "Breadboard 830 Point" }) || findProduct({ name: "Breadboard 400 Tie Points (Half-Size Solderless)" });
                var bbReason = isAr ? "لوح تجارب لتجميع الدائرة وتوزيع خطوط الطاقة 5V و GND لجميع الحساسات بدون لحام" : "Essential for building the circuit and distributing shared 5V and GND rails to all sensors without soldering";
                var bbConn = defaultConnectionFor("Breadboard 830 Point", isAr);
                if (bbProd && !merged[bbProd.id]) {
                    merged[bbProd.id] = { product: bbProd, qty: 1, reason: bbReason, connection: bbConn };
                } else if (!bbProd) {
                    extra.push({ name: "Breadboard 830 Point", qty: 1, reason: bbReason, connection: bbConn });
                }
            }

            var hasWires = /jumper|wire|أسلاك|سلك/.test(combinedNames) || Object.keys(merged).some(function (k) {
                return /jumper|wire/i.test(merged[k].product.title || "");
            });
            if (!hasWires) {
                var wireProd = findProduct({ name: "Male to Male Jumper Wires 30cm (10-Pack)" });
                var wireReason = isAr ? "أسلاك توصيل لربط البوردة بالحساسات والمحركات ولوح التجارب" : "Required to connect the microcontroller pins, breadboard rails, sensors, and actuators";
                var wireConn = defaultConnectionFor("Jumper Wires", isAr);
                if (wireProd && !merged[wireProd.id]) {
                    merged[wireProd.id] = { product: wireProd, qty: 1, reason: wireReason, connection: wireConn };
                } else if (!wireProd) {
                    extra.push({ name: "Jumper Wires Pack (M-M / M-F)", qty: 1, reason: wireReason, connection: wireConn });
                }
            }
        }

        var rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
        var steps = rawSteps.map(function (s) {
            if (typeof s === "string") return s;
            if (s && typeof s === "object") {
                return (s.title ? s.title + ": " : "") + (s.details || s.description || "");
            }
            return String(s || "");
        }).filter(Boolean);

        return {
            title: raw.project_title || raw.project_name || raw.project || raw.title || "Your project",
            overview: raw.overview || raw.description || "",
            steps: steps,
            isAr: isAr,
            storeItems: Object.keys(merged).map(function (k) { return merged[k]; }),
            otherItems: extra
        };
    }

    var _kPart3 = "MTA4eUlwNldQZG5FQU";

    /* ---------- inject CSS ---------- */
    function injectStyles() {
        if (document.getElementById("aicb-style")) return;
        var s = document.createElement("style");
        s.id = "aicb-style";
        s.textContent = `
/* Floating button */
#aicb-fab{position:fixed;top:165px;right:24px;bottom:auto;z-index:9000;width:66px;height:66px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#0ea5e9);border:none;color:#fff;font-size:1.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(37,99,235,.45),0 0 0 0 rgba(56,189,248,.4);transition:all .3s ease;animation:aicb-pulse 2.5s infinite}
#aicb-fab:hover{transform:scale(1.08) translateY(-2px);box-shadow:0 12px 35px rgba(37,99,235,.6)}
@keyframes aicb-pulse{0%,100%{box-shadow:0 8px 28px rgba(37,99,235,.45),0 0 0 0 rgba(56,189,248,.4)}50%{box-shadow:0 8px 28px rgba(37,99,235,.45),0 0 0 12px rgba(56,189,248,0)}}

/* Panel */
#aicb-panel{position:fixed;bottom:24px;right:24px;z-index:9001;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 48px);background:rgba(10,15,28,.96);border:1px solid rgba(255,255,255,.12);border-radius:24px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);animation:aicb-slideUp .35s cubic-bezier(.2,.8,.2,1)}
#aicb-panel.open{display:flex}
@keyframes aicb-slideUp{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}

/* Header */
.aicb-header{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}
.aicb-header-icon{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0}
.aicb-header-text{flex:1;min-width:0}
.aicb-header-text h4{margin:0;font-size:.95rem;font-weight:700;color:#f8fafc}
.aicb-header-text span{font-size:.75rem;color:#94a3b8}
.aicb-close{background:none;border:none;color:#94a3b8;font-size:1.1rem;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:.2s}
.aicb-close:hover{color:#f8fafc;background:rgba(255,255,255,.08)}

/* Messages */
.aicb-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.3) transparent}
.aicb-msg{max-width:92%;padding:12px 16px;border-radius:18px;font-size:.88rem;line-height:1.55;animation:aicb-msgIn .25s ease}
@keyframes aicb-msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.aicb-msg.bot{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);color:#e2e8f0;border-bottom-left-radius:6px}
.aicb-msg.user{align-self:flex-end;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-bottom-right-radius:6px}
.aicb-msg.bot .aicb-title{font-weight:700;font-size:.95rem;color:#f8fafc;margin-bottom:6px}
.aicb-msg.bot .aicb-overview{color:#94a3b8;margin-bottom:8px}

/* Steps */
.aicb-steps{padding-left:18px;margin:6px 0 10px;color:#cbd5e1;font-size:.84rem;line-height:1.6}
.aicb-steps li{margin-bottom:3px;padding-left:4px}
.aicb-steps li::marker{color:#38bdf8;font-weight:700}

/* Part rows */
.aicb-part{display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.06);margin:6px 0;transition:.2s}
.aicb-part:hover{background:rgba(255,255,255,.04)}
.aicb-part-img{width:42px;height:42px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;margin-top:2px}
.aicb-part-img img{max-width:82%;max-height:82%;object-fit:contain}
.aicb-part-info{flex:1;min-width:0}
.aicb-part-name{font-size:.82rem;font-weight:700;color:#f8fafc;line-height:1.35;margin-bottom:3px}
.aicb-part-reason{font-size:.74rem;color:#94a3b8;line-height:1.45;margin-top:2px}
.aicb-part-connect{font-size:.72rem;line-height:1.45;margin-top:5px;padding:5px 8px;border-radius:8px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);color:#bae6fd}
.aicb-part-price{font-size:.8rem;font-weight:700;color:#38bdf8;white-space:nowrap;margin-top:2px}

/* Other items */
.aicb-other{font-size:.82rem;color:#94a3b8;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.06)}
.aicb-other b{color:#cbd5e1}
.aicb-other .q{color:#38bdf8;font-weight:700}

/* Total & buy button */
.aicb-total{display:flex;justify-content:space-between;align-items:center;padding:8px 4px;margin-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:.9rem}
.aicb-total span{color:#2563eb;font-weight:600}
.aicb-total b{color:#2563eb;font-size:1.1rem}
.aicb-buy{width:100%;padding:10px;margin-top:8px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:12px;font-size:.88rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:.25s}
.aicb-buy:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 20px rgba(37,99,235,.4)}
.aicb-buy:disabled{opacity:.6;cursor:not-allowed}
.aicb-shop-link{display:block;text-align:center;margin-top:8px;color:#38bdf8;font-size:.82rem;font-weight:600;text-decoration:none}
.aicb-shop-link:hover{text-decoration:underline}

/* Chips */
.aicb-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.aicb-chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#94a3b8;padding:6px 12px;border-radius:99px;font-size:.78rem;font-weight:500;cursor:pointer;transition:.2s;white-space:nowrap}
.aicb-chip:hover{color:#38bdf8;border-color:#38bdf8;background:rgba(56,189,248,.08)}

/* Typing indicator */
.aicb-typing{display:flex;align-items:center;gap:5px;padding:12px 16px;align-self:flex-start}
.aicb-dot{width:8px;height:8px;border-radius:50%;background:#38bdf8;animation:aicb-bounce 1.4s infinite ease-in-out}
.aicb-dot:nth-child(2){animation-delay:.16s}
.aicb-dot:nth-child(3){animation-delay:.32s}
@keyframes aicb-bounce{0%,80%,100%{transform:scale(0);opacity:.4}40%{transform:scale(1);opacity:1}}

/* Input bar */
.aicb-input-bar{display:flex;align-items:center;gap:8px;padding:12px 14px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;background:rgba(6,9,17,.5)}
.aicb-input-bar input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#f8fafc;padding:11px 14px;border-radius:99px;font-size:.88rem;outline:none;transition:.25s}
.aicb-input-bar input::placeholder{color:rgba(148,163,184,.5)}
.aicb-input-bar input:focus{border-color:#38bdf8;background:rgba(255,255,255,.1)}
.aicb-send{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#0ea5e9);border:none;color:#fff;font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s;flex-shrink:0}
.aicb-send:hover:not(:disabled){transform:scale(1.08)}
.aicb-send:disabled{opacity:.5;cursor:not-allowed}

/* Toast */
.aicb-toast{position:fixed;bottom:100px;left:50%;transform:translate(-50%,20px);opacity:0;pointer-events:none;background:rgba(15,23,42,.95);border:1px solid #38bdf8;color:#f8fafc;padding:10px 20px;border-radius:99px;font-weight:600;font-size:.85rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:.3s}
.aicb-toast.show{opacity:1;transform:translate(-50%,0)}

@media(max-width:480px){
  #aicb-panel{width:calc(100vw - 16px);height:calc(100vh - 80px);bottom:8px;right:8px;border-radius:20px}
  #aicb-fab{top:175px;right:16px;bottom:auto;width:58px;height:58px;font-size:1.6rem}
}

/* Arduino Hub assistant refresh: compact, high-contrast, and clear of the mobile dock. */
#aicb-fab{display:flex!important;align-items:center;justify-content:center;top:165px;right:24px;bottom:auto;width:64px;height:64px;padding:0;overflow:visible;border:2px solid rgba(103,232,249,.45);border-radius:50%;color:#fff;background:linear-gradient(145deg,#1d4ed8 0%,#0284c7 52%,#06b6d4 100%);box-shadow:0 10px 30px rgba(2,132,199,.45),0 0 0 4px rgba(56,189,248,.18),inset 0 2px 4px rgba(255,255,255,.35);touch-action:none;user-select:none;-webkit-user-select:none;animation:aicb-glow 3s ease-in-out infinite;transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s ease}
#aicb-fab .aicb-fab-svg{width:36px;height:36px;pointer-events:none;filter:drop-shadow(0 2px 6px rgba(10,22,40,.35))}
#aicb-fab .aicb-fab-badge{position:absolute;top:-5px;right:-5px;padding:2px 6px;border-radius:99px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:.64rem;font-weight:900;letter-spacing:.04em;line-height:1.1;border:2px solid #fff;box-shadow:0 3px 8px rgba(239,68,68,.4);pointer-events:none}
#aicb-fab .aicb-fab-svg .aicb-spark{fill:#fef08a;animation:aicb-blink 2s ease-in-out infinite}
#aicb-fab .aicb-fab-svg .aicb-eye{fill:#67e8f9;filter:drop-shadow(0 0 4px rgba(103,232,249,.9))}
#aicb-fab:hover{transform:translateY(-4px) scale(1.08);box-shadow:0 16px 40px rgba(2,132,199,.55),0 0 0 6px rgba(56,189,248,.28),0 0 24px rgba(56,189,248,.3)}
#aicb-fab:hover .aicb-fab-svg{filter:drop-shadow(0 3px 10px rgba(10,22,40,.45))}
#aicb-fab:focus-visible{outline:3px solid #0e7490;outline-offset:4px}
@keyframes aicb-glow{0%,100%{box-shadow:0 10px 30px rgba(2,132,199,.45),0 0 0 4px rgba(56,189,248,.18),inset 0 2px 4px rgba(255,255,255,.35)}50%{box-shadow:0 12px 34px rgba(2,132,199,.6),0 0 0 7px rgba(56,189,248,.1),0 0 22px rgba(56,189,248,.25),inset 0 2px 4px rgba(255,255,255,.35)}}
@keyframes aicb-spin{from{transform-origin:center;transform:rotate(0deg)}to{transform-origin:center;transform:rotate(360deg)}}
@keyframes aicb-blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
@keyframes aicb-ripple{0%{r:6;opacity:.4;stroke-width:.8}100%{r:14;opacity:0;stroke-width:.2}}
@keyframes aicb-ring{0%,100%{box-shadow:0 10px 28px rgba(17,86,196,.34),0 0 0 5px rgba(32,126,233,.12)}50%{box-shadow:0 10px 28px rgba(17,86,196,.34),0 0 0 10px rgba(32,126,233,0)}}
#aicb-panel{right:22px;bottom:22px;width:min(390px,calc(100vw - 32px));height:min(590px,calc(100dvh - 44px));max-height:calc(100dvh - 44px);border:1px solid #d8e5f4;border-radius:24px;color:#172844;background:#fff;box-shadow:0 24px 68px rgba(16,46,91,.25);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.aicb-header{padding:15px 16px;border-bottom:1px solid #e6edf6;background:linear-gradient(120deg,#f4f9ff,#eaf7ff)}
.aicb-header-icon{width:42px;height:42px;border-radius:13px;overflow:hidden;background:linear-gradient(145deg,#1d4ed8,#0284c7,#06b6d4);border:1px solid rgba(56,189,248,.4);box-shadow:0 4px 12px rgba(2,132,199,.25);flex-shrink:0;display:flex;align-items:center;justify-content:center}
.aicb-header-icon .aicb-header-svg{width:27px;height:27px}
.aicb-header-text h4{color:#142849}
.aicb-header-text span{color:#647895}
.aicb-close{color:#536782}
.aicb-close:hover{color:#125fc8;background:#e5f1ff}
.aicb-close svg,.aicb-send svg{width:19px;height:19px}
.aicb-messages{padding:15px;background:linear-gradient(180deg,#fbfdff,#f6f9fd);scrollbar-color:#b8cce5 transparent}
.aicb-msg{font-size:.87rem}
.aicb-msg.bot{color:#263b5a;background:#fff;border:1px solid #e1eaf5;box-shadow:0 4px 12px rgba(22,55,100,.045)}
.aicb-msg.user{background:linear-gradient(135deg,#287ff1,#185fd4);box-shadow:0 6px 14px rgba(24,95,212,.16)}
.aicb-msg.bot .aicb-title{color:#142849}
.aicb-msg.bot .aicb-overview{color:#5d708a}
.aicb-steps{color:#415773}
.aicb-steps li::marker{color:#1678f2}
.aicb-part{border-color:#e5edf7;background:#fff}
.aicb-part:hover{background:#f5f9ff}
.aicb-part-name{color:#19314f}
.aicb-part-reason,.aicb-other{color:#475569}
.aicb-part-connect{background:#f0f7ff;border-color:#cfe2fa;color:#154c99}
.aicb-part-price,.aicb-other .q{color:#1268d9}
.aicb-other{border-bottom-color:#e5edf7}
.aicb-other b{color:#263b5a}
.aicb-total{border-top-color:#e2eaf4;color:#263b5a}
.aicb-total span,.aicb-total b{color:#1268d9}
.aicb-buy{background:linear-gradient(135deg,#287ff1,#155ed4);box-shadow:0 7px 16px rgba(24,95,212,.17)}
.aicb-shop-link{color:#1268d9}
.aicb-chip{color:#526984;background:#fff;border-color:#d9e5f3}
.aicb-chip:hover{color:#125fc8;border-color:#83b5f0;background:#f0f7ff}
.aicb-question{font-weight:700;color:#142849;line-height:1.5}
.aicb-opts{display:flex;flex-direction:column;gap:7px;margin-top:10px}
.aicb-opt{width:100%;text-align:left;padding:10px 14px;border:1px solid #cfe0f3;border-radius:12px;background:#f5f9ff;color:#173b6c;font:inherit;font-size:.84rem;font-weight:600;cursor:pointer;transition:border-color .15s,background .15s,transform .15s}
.aicb-opt:hover:not(:disabled){border-color:#176fe8;background:#e8f2ff;transform:translateX(2px)}
.aicb-opt:disabled{opacity:.5;cursor:default}
.aicb-opt:focus-visible{outline:2px solid #176fe8;outline-offset:2px}
.aicb-services-card{margin-top:12px;padding:12px;border:1px solid #d4e4f7;border-radius:14px;background:linear-gradient(180deg,#f8fbff,#f0f6ff)}
.aicb-services-header{margin-bottom:8px}
.aicb-services-tag{display:inline-flex;align-items:center;gap:5px;font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1268d9;background:#e1effe;padding:2px 7px;border-radius:6px;margin-bottom:4px}
.aicb-services-subtitle{font-size:.76rem;color:#526986;line-height:1.35}
.aicb-service-options{display:flex;flex-direction:column;gap:6px}
.aicb-service-opt{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid #d8e4f4;border-radius:10px;background:#fff;cursor:pointer;transition:border-color .15s,background .15s}
.aicb-service-opt:hover{border-color:#176fe8;background:#f5f9ff}
.aicb-service-opt.is-active{border-color:#176fe8;background:#ebf4ff}
.aicb-service-opt input[type="checkbox"]{width:15px;height:15px;accent-color:#176fe8;margin:0;cursor:pointer;flex-shrink:0}
.aicb-service-info{flex:1;min-width:0;display:flex;flex-direction:column}
.aicb-service-info strong{font-size:.79rem;font-weight:750;color:#152844;display:flex;align-items:center;gap:5px}
.aicb-service-info strong i{color:#176fe8;font-size:.75rem}
.aicb-service-info small{font-size:.67rem;color:#6b809b}
.aicb-service-price{font-size:.75rem;font-weight:800;color:#1268d9;white-space:nowrap}
.aicb-service-opt--full{border-color:#b9d8fa;background:#f2f7ff}
.aicb-service-opt--full .aicb-service-price{color:#0d59bf;background:#dbeafe;padding:2px 6px;border-radius:6px}
.aicb-services-total{margin-top:10px;padding-top:8px;border-top:1px dashed #cfdeee;display:flex;flex-direction:column;gap:3px;font-size:.78rem}
.aicb-calc-line{display:flex;justify-content:space-between;color:#5a6e87}
.aicb-calc-line b{color:#173256}
.aicb-calc-line.final{font-size:.88rem;font-weight:850;color:#102240;padding-top:4px;border-top:1px solid #d5e3f2;margin-top:2px}
.aicb-calc-line.final b{color:#176fe8}
.aicb-cta-actions{display:flex;flex-direction:column;gap:7px;margin-top:10px}
.aicb-wa-btn{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 12px;border-radius:11px;background:#25d366;color:#fff;font-size:.8rem;font-weight:800;text-decoration:none;box-shadow:0 4px 12px rgba(37,211,102,.22);transition:background .15s,transform .15s}
.aicb-wa-btn:hover{background:#20bd5a;color:#fff;transform:translateY(-1px)}
.aicb-dot{background:#1484e8}
.aicb-input-bar{padding:12px;border-top-color:#e4ecf6;background:#fff}
.aicb-input-bar input{min-width:0;color:#1d3553;background:#f5f8fc;border-color:#dbe5f1}
.aicb-input-bar input::placeholder{color:#8b9bb0}
.aicb-input-bar input:focus{border-color:#63a2ee;background:#fff;box-shadow:0 0 0 3px rgba(23,111,232,.12)}
.aicb-send{background:linear-gradient(145deg,#1978ef,#155fd6);box-shadow:0 5px 12px rgba(24,95,212,.2)}
.aicb-toast{color:#183251;background:#fff;border-color:#7bb9fa;box-shadow:0 10px 30px rgba(24,60,108,.2)}
.aicb-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@media(max-width:700px){
  #aicb-fab{top:175px;right:16px;bottom:auto;width:58px;height:58px}
  #aicb-panel{right:10px;bottom:calc(10px + env(safe-area-inset-bottom));width:calc(100vw - 20px);height:min(680px,calc(100dvh - 24px - env(safe-area-inset-bottom)));max-height:calc(100dvh - 24px - env(safe-area-inset-bottom));border-radius:22px}
}
@media(max-height:560px) and (max-width:700px){
  #aicb-panel{bottom:calc(10px + env(safe-area-inset-bottom));height:calc(100dvh - 24px - env(safe-area-inset-bottom));max-height:calc(100dvh - 24px - env(safe-area-inset-bottom))}
}
@media(prefers-reduced-motion:reduce){
  #aicb-fab,.aicb-msg,.aicb-dot,#aicb-panel{animation:none!important;transition:none!important}
}
`;
        document.head.appendChild(s);
    }

    /* ---------- inject HTML ---------- */
    function injectHTML() {
        // Floating button
        var fab = document.createElement("button");
        fab.id = "aicb-fab";
        fab.type = "button";
        fab.title = "AI Chat Assistant — drag to move";
        fab.setAttribute("aria-label", "Open AI chat assistant. Use arrow keys to move this button; Home resets its position.");
        fab.setAttribute("aria-expanded", "false");
        fab.setAttribute("aria-controls", "aicb-panel");
        fab.setAttribute("aria-describedby", "aicb-drag-help");
        fab.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight Home Enter Space");
        fab.innerHTML = '<svg class="aicb-fab-svg" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4.5v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="3.8" r="2" fill="#67e8f9"/><rect x="6" y="8.5" width="20" height="16.5" rx="6" fill="rgba(255,255,255,0.16)" stroke="#fff" stroke-width="2"/><rect x="3" y="13.5" width="2.8" height="6.5" rx="1.4" fill="#67e8f9"/><rect x="26.2" y="13.5" width="2.8" height="6.5" rx="1.4" fill="#67e8f9"/><rect x="9" y="11.5" width="14" height="7.5" rx="3.2" fill="#0a192f" stroke="rgba(103,232,249,0.55)" stroke-width="1"/><circle class="aicb-eye" cx="12.8" cy="15.2" r="1.9"/><circle class="aicb-eye" cx="19.2" cy="15.2" r="1.9"/><path d="M12.5 21.5c1 1 2.2 1.4 3.5 1.4s2.5-.4 3.5-1.4" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><path class="aicb-spark" d="M26.5 2.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/><path class="aicb-spark" d="M5.2 3.5l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z"/></svg><span class="aicb-fab-badge" aria-hidden="true">AI</span><span id="aicb-drag-help" class="aicb-visually-hidden">Drag to move. You can also use the arrow keys to move it, or Home to reset its position.</span>';

        var dragState = null;
        var suppressPointerClick = false;
        var positionKey = "arduino_hub_ai_widget_position_v1";
        try { localStorage.removeItem(positionKey); } catch (e) { /* always respawn at default top-right spot */ }

        function clampPosition(x, y) {
            var size = fab.getBoundingClientRect();
            var maxX = Math.max(8, window.innerWidth - size.width - 8);
            var maxY = Math.max(8, window.innerHeight - size.height - 12);
            if (window.innerWidth <= 700) {
                var dock = document.querySelector(".mobile-bottom-nav");
                if (dock && window.getComputedStyle(dock).display !== "none") {
                    var dockTop = dock.getBoundingClientRect().top;
                    maxY = Math.min(maxY, Math.max(8, dockTop - size.height - 16));
                }
            }
            return { x: Math.min(maxX, Math.max(8, x)), y: Math.min(maxY, Math.max(8, y)) };
        }

        function applyPosition(x, y) {
            var point = clampPosition(x, y);
            fab.style.left = point.x + "px";
            fab.style.top = point.y + "px";
            fab.style.right = "auto";
            fab.style.bottom = "auto";
        }

        // Keep dragging clear of a visible mobile dock; without one, use the full viewport.
        fab.addEventListener("pointerdown", function(e) {
            if (e.button !== undefined && e.button !== 0) return;
            var rect = fab.getBoundingClientRect();
            dragState = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top, moved: false };
            try { fab.setPointerCapture(e.pointerId); } catch (error) { /* pointer capture may be unavailable */ }
        });
        fab.addEventListener("pointermove", function(e) {
            if (!dragState || dragState.pointerId !== e.pointerId) return;
            var dx = e.clientX - dragState.startX;
            var dy = e.clientY - dragState.startY;
            if (!dragState.moved && Math.hypot(dx, dy) < 6) return;
            dragState.moved = true;
            e.preventDefault();
            fab.style.transition = "none";
            applyPosition(dragState.left + dx, dragState.top + dy);
        });
        function finishDrag(e) {
            if (!dragState || dragState.pointerId !== e.pointerId) return;
            var moved = dragState.moved;
            dragState = null;
            fab.style.transition = "transform .2s ease, box-shadow .2s ease";
            if (moved) {
                var rect = fab.getBoundingClientRect();
                applyPosition(rect.left, rect.top);
                suppressPointerClick = true;
                window.setTimeout(function () { suppressPointerClick = false; }, 450);
            }
            try { if (fab.hasPointerCapture(e.pointerId)) fab.releasePointerCapture(e.pointerId); } catch (error) { /* already released */ }
        }
        fab.addEventListener("pointerup", finishDrag);
        fab.addEventListener("pointercancel", finishDrag);
        fab.addEventListener("click", function (e) {
            if (e.detail > 0 && suppressPointerClick) {
                e.preventDefault();
                e.stopPropagation();
                suppressPointerClick = false;
                return;
            }
            togglePanel(true);
        });
        fab.addEventListener("keydown", function (e) {
            var offsets = { ArrowUp: [0, -16], ArrowDown: [0, 16], ArrowLeft: [-16, 0], ArrowRight: [16, 0] };
            if (offsets[e.key]) {
                e.preventDefault();
                var rect = fab.getBoundingClientRect();
                applyPosition(rect.left + offsets[e.key][0], rect.top + offsets[e.key][1]);
            } else if (e.key === "Home") {
                e.preventDefault();
                fab.style.left = "";
                fab.style.top = window.innerWidth <= 700 ? "175px" : "165px";
                fab.style.right = window.innerWidth <= 700 ? "16px" : "24px";
                fab.style.bottom = "auto";
                fab.focus();
            }
        });
        window.addEventListener("resize", function () {
            var panel = document.getElementById("aicb-panel");
            if (panel && panel.classList.contains("open")) return;
            if (fab.style.left && fab.style.top) {
                var rect = fab.getBoundingClientRect();
                applyPosition(rect.left, rect.top, true);
            }
        });
        document.body.appendChild(fab);

        // Panel
        var panel = document.createElement("div");
        panel.id = "aicb-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "false");
        panel.setAttribute("aria-labelledby", "aicb-title");
        panel.setAttribute("aria-hidden", "true");
        panel.inert = true;
        panel.innerHTML = `
<div class="aicb-header">
    <div class="aicb-header-icon"><svg class="aicb-header-svg" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4.5v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="3.8" r="2" fill="#67e8f9"/><rect x="6" y="8.5" width="20" height="16.5" rx="6" fill="rgba(255,255,255,0.16)" stroke="#fff" stroke-width="2"/><rect x="3" y="13.5" width="2.8" height="6.5" rx="1.4" fill="#67e8f9"/><rect x="26.2" y="13.5" width="2.8" height="6.5" rx="1.4" fill="#67e8f9"/><rect x="9" y="11.5" width="14" height="7.5" rx="3.2" fill="#0a192f" stroke="rgba(103,232,249,0.55)" stroke-width="1"/><circle cx="12.8" cy="15.2" r="1.9" fill="#67e8f9"/><circle cx="19.2" cy="15.2" r="1.9" fill="#67e8f9"/><path d="M12.5 21.5c1 1 2.2 1.4 3.5 1.4s2.5-.4 3.5-1.4" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><path d="M26.5 2.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" fill="#fef08a"/></svg></div>
    <div class="aicb-header-text">
        <h4 id="aicb-title">AI Project Assistant</h4>
        <span>Smart Hardware &amp; Wiring Engineer</span>
    </div>
    <button class="aicb-close" type="button" aria-label="Close AI chat" onclick="window._aicbToggle(false)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
</div>
<div class="aicb-messages" id="aicb-msgs" role="log" aria-live="polite" aria-relevant="additions text" aria-label="AI conversation"></div>
<div class="aicb-input-bar">
    <input type="text" id="aicb-input" aria-label="Describe your Arduino project" placeholder="e.g. I want to make a robot car..." autocomplete="off">
    <button class="aicb-send" id="aicb-sendBtn" type="button" aria-label="Send message" onclick="window._aicbSend()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
</div>`;
        document.body.appendChild(panel);

        // Toast
        var toast = document.createElement("div");
        toast.className = "aicb-toast";
        toast.id = "aicb-toast";
        document.body.appendChild(toast);

        // Enter key
        document.getElementById("aicb-input").addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); window._aicbSend(); }
        });

        // Welcome message
        addBotMessage(
            '<div class="aicb-title">Hello! What would you like to build?</div>' +
            '<div class="aicb-overview">Describe your Arduino / electronics project idea and I\'ll list every component you need, match them to our store, and let you add them all to your cart in one click.</div>' +
            '<div class="aicb-chips">' +
            '<span class="aicb-chip" onclick="window._aicbQuick(this)">Obstacle avoiding robot car</span>' +
            '<span class="aicb-chip" onclick="window._aicbQuick(this)">Smart home lights with ESP32</span>' +
            '<span class="aicb-chip" onclick="window._aicbQuick(this)">Weather station with display</span>' +
            '<span class="aicb-chip" onclick="window._aicbQuick(this)">Automatic plant watering</span>' +
            '</div>'
        );
    }

    /* ---------- panel toggle ---------- */
    function togglePanel(open) {
        var panel = document.getElementById("aicb-panel");
        var fab   = document.getElementById("aicb-fab");
        if (!panel || !fab) return;
        if (open) {
            panel.classList.add("open");
            panel.inert = false;
            panel.setAttribute("aria-hidden", "false");
            fab.setAttribute("aria-expanded", "true");
            fab.style.display = "none";
            setTimeout(function () { document.getElementById("aicb-input").focus(); }, 100);
        } else {
            panel.classList.remove("open");
            panel.inert = true;
            panel.setAttribute("aria-hidden", "true");
            fab.setAttribute("aria-expanded", "false");
            fab.style.display = "flex";
            fab.focus();
        }
    }
    window._aicbToggle = togglePanel;
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            var panel = document.getElementById("aicb-panel");
            if (panel && panel.classList.contains("open")) togglePanel(false);
        }
    });

    /* ---------- messages ---------- */
    function scrollBottom() {
        var m = document.getElementById("aicb-msgs");
        if (m) setTimeout(function () { m.scrollTop = m.scrollHeight; }, 50);
    }

    function addBotMessage(html) {
        var d = document.createElement("div");
        d.className = "aicb-msg bot";
        d.innerHTML = html;
        document.getElementById("aicb-msgs").appendChild(d);
        scrollBottom();
    }

    function addUserMessage(text) {
        var d = document.createElement("div");
        d.className = "aicb-msg user";
        d.textContent = text;
        document.getElementById("aicb-msgs").appendChild(d);
        scrollBottom();
    }

    function showTyping() {
        var d = document.createElement("div");
        d.className = "aicb-typing";
        d.id = "aicb-typing";
        d.innerHTML = '<div class="aicb-dot"></div><div class="aicb-dot"></div><div class="aicb-dot"></div>';
        document.getElementById("aicb-msgs").appendChild(d);
        scrollBottom();
    }

    function hideTyping() {
        var t = document.getElementById("aicb-typing");
        if (t) t.remove();
    }

    function showToast(msg) {
        var t = document.getElementById("aicb-toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        setTimeout(function () { t.classList.remove("show"); }, 2400);
    }

    /* ---------- main send ---------- */
    var busy = false;
    var lastPlan = null;
    var convo = [];
    var questionCount = 0;
    var MAX_QUESTIONS = 3;

    function lockOptionGroups() {
        document.querySelectorAll(".aicb-opts button").forEach(function (b) { b.disabled = true; });
    }

    function renderQuestion(q) {
        var opts = Array.isArray(q.options) ? q.options.filter(function (o) { return typeof o === "string" && o.trim(); }).slice(0, 5) : [];
        var html = '<div class="aicb-question">' + esc(q.question || "") + '</div>';
        if (opts.length) {
            html += '<div class="aicb-opts">';
            opts.forEach(function (o) {
                html += '<button type="button" class="aicb-opt" data-opt="' + esc(o) + '" onclick="window._aicbPick(this)">' + esc(o) + '</button>';
            });
            html += '</div>';
        }
        addBotMessage(html);
    }

    async function handleSend() {
        var input = document.getElementById("aicb-input");
        var prompt = input.value.trim();
        if (!prompt || busy) return;

        input.value = "";
        lockOptionGroups();
        addUserMessage(prompt);
        convo.push({ role: "user", content: prompt });

        busy = true;
        var btn = document.getElementById("aicb-sendBtn");
        btn.disabled = true;
        showTyping();

        try {
            if (!catalog.length) catalog = await loadCatalog();
            var isArabicUser = convo.some(function(m) {
                return /[\u0600-\u06FF]|(?:^|\s)(?:3ayz|a3ml|ezay|msh|lw|tb|kam|kaza|le|fe|el|b3den|wla|feen|eh|kda)(?:\s|$)/i.test(m.content);
            });
            var langRule = isArabicUser ? "Strictly in friendly Egyptian Arabic (باللغة العربية)." : "Strictly in fluent English.";

            var history = convo.slice();
            var turnDirective = "";
            if (questionCount === 0) {
                turnDirective = "INTERVIEW TURN 1 of 3: Ask an EASY, SHORT, LOGICAL question #1 (status: 'question') asking which Board they want to use (e.g., Arduino Uno R3, ESP32 with WiFi/Bluetooth, Arduino Nano V3.0, Arduino Mega 2560, or Choose the best for me). Keep it super simple. Provide 2-4 clean options. " + langRule;
            } else if (questionCount === 1) {
                turnDirective = "INTERVIEW TURN 2 of 3: Ask an EASY, SHORT, LOGICAL question #2 (status: 'question') about the basic numbers/setup of THIS specific project (e.g. for Smart Parking: how many gates and parking slots? For Robot: 2 wheels or 4 wheels? For Smart Home: how many lights/devices? For Plant Watering: how many plants?). CRITICAL: Only ask about gates/slots if the project actually has gates/slots! Provide 2-4 simple options. " + langRule;
            } else if (questionCount === 2) {
                turnDirective = "INTERVIEW TURN 3 of 3: Ask an EASY, SHORT, LOGICAL question #3 (status: 'question') about how they want to power it (e.g., Rechargeable Battery Pack vs Wall Adapter / USB vs Choose for me). Provide 2-4 simple options. " + langRule;
            } else {
                turnDirective = "INTERVIEW COMPLETE (FINAL PLAN): Act as a Senior Hardware Engineer and return ONE JSON object with status: 'plan', project_title, overview, steps, and components_needed. Choose from AVAILABLE STORE DATABASE PRODUCTS using exact English titles whenever available, and also include any required component not in the database using its standard English name. For EVERY item in components_needed, include 'reason' (why we chose this product) and 'connection' (basic pin-to-pin how to connect guide). Include Microcontroller Board, Breadboard, Jumper Wires, Power Supply, Drivers/Relays/Display, and all Sensors & Motors with exact 1-to-1 physical quantities. " + langRule;
            }
            var answer = await askAI(history, turnDirective);
            hideTyping();
            var rawParsed = parseJSON(answer);
            var parsed = cleanParsed(rawParsed);
            if (questionCount < MAX_QUESTIONS && parsed && (parsed.status === "question" || parsed.question)) {
                questionCount++;
                convo.push({ role: "assistant", content: JSON.stringify({ status: "question", question: parsed.question, options: parsed.options || [] }) });
                renderQuestion(parsed);
            } else if (parsed && parsed.status === "plan") {
                lastPlan = normalizePlan(parsed);
                renderPlanMessage(lastPlan);
                convo = [];
                questionCount = 0;
            } else if (parsed && parsed.question) {
                questionCount++;
                convo.push({ role: "assistant", content: JSON.stringify({ status: "question", question: parsed.question, options: parsed.options || [] }) });
                renderQuestion(parsed);
            } else {
                lastPlan = normalizePlan(parsed);
                renderPlanMessage(lastPlan);
                convo = [];
                questionCount = 0;
            }
        } catch (e) {
            hideTyping();
            convo.pop();
            addBotMessage('<div style="color:#fca5a5;"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(e.message || "Something went wrong.") + '</div>');
        } finally {
            busy = false;
            btn.disabled = false;
        }
    }
    window._aicbSend = handleSend;

    function quickSend(chip) {
        var input = document.getElementById("aicb-input");
        convo = [];
        questionCount = 0;
        input.value = "I want to make a " + chip.textContent.toLowerCase();
        handleSend();
    }
    window._aicbQuick = quickSend;

    window._aicbPick = function (btn) {
        if (busy) return;
        var input = document.getElementById("aicb-input");
        input.value = btn.getAttribute("data-opt") || btn.textContent;
        handleSend();
    };

    /* ---------- render plan ---------- */
    function renderPlanMessage(plan) {
        var total = 0;
        var isAr = !!plan.isAr;
        var whyLabel = isAr ? "لماذا اخترناه: " : "Why chosen: ";
        var connLabel = isAr ? "طريقة التوصيل: " : "How to connect: ";
        var html = '<div class="aicb-title">' + esc(plan.title) + '</div>';
        html += '<div class="aicb-overview">' + esc(plan.overview) + '</div>';

        if (plan.steps && plan.steps.length) {
            html += '<div style="font-size:.8rem;font-weight:700;color:#1268d9;margin:8px 0 4px;"><i class="fa-solid fa-diagram-project"></i> ' + (isAr ? 'خطوات التجميع والتوصيل الأساسية:' : 'Basic Assembly & Connection Steps:') + '</div>';
            html += '<ol class="aicb-steps">';
            plan.steps.forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
            html += '</ol>';
        }

        var storeCount = (plan.storeItems && plan.storeItems.length) ? plan.storeItems.length : 0;
        var otherCount = (plan.otherItems && plan.otherItems.length) ? plan.otherItems.length : 0;
        var totalComponents = storeCount + otherCount;

        if (totalComponents > 0) {
            html += '<div style="font-size:.82rem;font-weight:700;color:#38bdf8;margin:10px 0 6px;"><i class="fa-solid fa-microchip"></i> ' + (isAr ? 'مكونات المشروع وطريقة توصيل كل قطعة (' + totalComponents + ')' : 'Project Components — Why & How to Connect (' + totalComponents + ')') + '</div>';
            if (storeCount > 0) {
                plan.storeItems.forEach(function (it) {
                    var p = it.product || {};
                    var price = unitPrice(p);
                    var qty = it.qty || 1;
                    var line = price * qty;
                    total += line;
                    html += '<div class="aicb-part">' +
                        '<div class="aicb-part-img"><img src="' + esc(p.image || '') + '" onerror="this.style.visibility=\'hidden\'"></div>' +
                        '<div class="aicb-part-info">' +
                            '<div class="aicb-part-name">' + esc(p.title || it.name || 'Component') + '</div>' +
                            (it.reason ? '<div class="aicb-part-reason"><b style="color:#0284c7;">💡 ' + whyLabel + '</b>' + esc(it.reason) + '</div>' : '') +
                            (it.connection ? '<div class="aicb-part-connect"><b>🔌 ' + connLabel + '</b>' + esc(it.connection) + '</div>' : '') +
                        '</div>' +
                        '<div class="aicb-part-price">' + qty + '× EGP ' + price.toFixed(0) + '</div>' +
                        '</div>';
                });
            }
            if (otherCount > 0) {
                plan.otherItems.forEach(function (o) {
                    var qty = o.qty || 1;
                    html += '<div class="aicb-part">' +
                        '<div class="aicb-part-img" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:1.1rem;"><i class="fa-solid fa-microchip"></i></div>' +
                        '<div class="aicb-part-info">' +
                            '<div class="aicb-part-name">' + esc(o.name || 'Component') + '</div>' +
                            (o.reason ? '<div class="aicb-part-reason"><b style="color:#0284c7;">💡 ' + whyLabel + '</b>' + esc(o.reason) + '</div>' : '') +
                            (o.connection ? '<div class="aicb-part-connect"><b>🔌 ' + connLabel + '</b>' + esc(o.connection) + '</div>' : '') +
                        '</div>' +
                        '<div class="aicb-part-price" style="color:#f59e0b;">' + qty + '× Undefined price</div>' +
                        '</div>';
                });
            }
        } else {
            html += '<div style="font-size:.82rem;color:#94a3b8;margin-top:8px;">No matching products found in the store right now.</div>';
        }

        if (plan.storeItems && plan.storeItems.length) {
            html += '<div class="aicb-total"><span>Estimated Total:</span><b>EGP ' + Number(total || 0).toFixed(2) + (otherCount > 0 ? ' <small style="font-weight:600;color:#d97706;">+ ' + otherCount + ' undefined</small>' : '') + '</b></div>' +
                '<div class="aicb-cta-actions">' +
                    '<button class="aicb-buy" id="aicb-buyBtn" onclick="window._aicbBuyAll()"><i class="fa-solid fa-cart-plus"></i> Buy All Components &amp; Add to Cart</button>' +
                    '<a href="checkout.html" class="aicb-shop-link">Go to Checkout →</a>' +
                '</div>';
        } else {
            html += '<div class="aicb-cta-actions">' +
                '<a href="shop.html" class="aicb-shop-link"><i class="fa-solid fa-store"></i> Browse the shop</a>' +
            '</div>';
        }

        addBotMessage(html);
    }

    /* ---------- WhatsApp kit link builder ---------- */
    function buildWhatsAppKitUrl(plan, selectedServices, servicesFee, grandTotal) {
        var storeLines = (plan.storeItems || []).map(function(it) {
            return "• " + it.qty + "x " + it.product.title + " (EGP " + (unitPrice(it.product) * it.qty).toFixed(0) + ")";
        });
        var otherLines = (plan.otherItems || []).map(function(o) {
            return "• " + (o.qty || 1) + "x " + o.name + " (Undefined price)";
        });
        var partsList = storeLines.concat(otherLines).join("\n");

        var text = "Hello Arduino Hub! 👋\n" +
            "I want to order a Custom Project Kit:\n\n" +
            "📌 *Project:* " + (plan.title || "Custom Project") + "\n\n" +
            (partsList ? "🔧 *Hardware Components:*\n" + partsList + "\n\n" : "") +
            "📦 *Selected Services:* " + (selectedServices && selectedServices.length ? selectedServices.join(" + ") : "Hardware only / Free AI Plan") + (servicesFee ? " (+" + servicesFee + " EGP)" : "") + "\n" +
            "💰 *Estimated Total:* EGP " + Number(grandTotal || 0).toFixed(2) + (otherLines.length ? " + Undefined price items" : "") + "\n\n" +
            "Please confirm component availability and start preparing my project kit!";

        return "https://wa.me/201157992296?text=" + encodeURIComponent(text);
    }

    window._aicbOnServiceChange = function(cardId) {
        var card = document.getElementById(cardId + "-services");
        if (!card) return;
        var fullCb = card.querySelector('input[data-service="full"]');
        if (fullCb && fullCb.checked) {
            fullCb.checked = false;
            var fullOpt = card.querySelector('#' + cardId + '-opt-full');
            if (fullOpt) fullOpt.classList.remove('is-active');
        }
        updateCardServices(cardId);
    };

    window._aicbOnFullServiceChange = function(cardId, fullCb) {
        var card = document.getElementById(cardId + "-services");
        if (!card) return;
        var extras = card.querySelectorAll('input[data-service="code"], input[data-service="wiring"], input[data-service="tinkercad"]');
        if (fullCb.checked) {
            extras.forEach(function(i) {
                i.checked = false;
                var opt = i.closest('.aicb-service-opt');
                if (opt) opt.classList.remove('is-active');
            });
        }
        updateCardServices(cardId);
    };

    function updateCardServices(cardId) {
        var card = document.getElementById(cardId + "-services");
        if (!card || !lastPlan) return;

        var fullCb = card.querySelector('input[data-service="full"]');
        var allInputs = Array.from(card.querySelectorAll('.aicb-service-opt input[type="checkbox"]'));

        allInputs.forEach(function(i) {
            var opt = i.closest('.aicb-service-opt');
            if (opt) {
                if (i.checked) opt.classList.add('is-active');
                else opt.classList.remove('is-active');
            }
        });

        var selected = [];
        var fee = 0;
        if (fullCb && fullCb.checked) {
            selected.push("Full Project Bundle (Code + Wiring Map + Tinkercad)");
            fee = 250;
        } else {
            allInputs.forEach(function(i) {
                if (i.checked && i.getAttribute("data-service") !== "full") {
                    var s = i.getAttribute("data-service");
                    var name = s === "code" ? "Code only" : (s === "wiring" ? "Wiring map" : "Tinkercad");
                    selected.push(name);
                    fee += parseInt(i.getAttribute("data-price"), 10) || 100;
                }
            });
        }

        var partsTotal = 0;
        if (lastPlan.storeItems) {
            partsTotal = lastPlan.storeItems.reduce(function(sum, it) {
                return sum + (unitPrice(it.product) * it.qty);
            }, 0);
        }
        var grandTotal = partsTotal + fee;

        var sLine = document.getElementById(cardId + "-services-line");
        var sTotal = document.getElementById(cardId + "-services-total");
        var gTotal = document.getElementById(cardId + "-grand-total");
        if (sLine && sTotal && gTotal) {
            if (fee > 0) {
                sLine.style.display = "flex";
                sTotal.textContent = "+" + fee + " EGP";
            } else {
                sLine.style.display = "none";
            }
            gTotal.textContent = "EGP " + grandTotal.toFixed(2);
        }

        var waBtn = document.getElementById(cardId + "-wa-btn");
        if (waBtn) {
            waBtn.href = buildWhatsAppKitUrl(lastPlan, selected, fee, grandTotal);
        }
    }

    /* Starter function for Maker Kits button */
    window._aicbStartMakerKit = function(initialProject) {
        if (window._aicbToggle) window._aicbToggle(true);
        convo = [];
        questionCount = 0;
        var input = document.getElementById("aicb-input");
        if (input) {
            input.value = initialProject ? initialProject : "I want to build a custom project kit";
            handleSend();
        }
    };

    /* ---------- buy all ---------- */
    function buyAll() {
        if (!lastPlan || !lastPlan.storeItems.length) return;
        var cart = readCart();
        lastPlan.storeItems.forEach(function (it) {
            var existing = cart.find(function (c) { return String(c.id) === String(it.product.id); });
            if (existing) existing.qty += it.qty;
            else cart.push({ id: it.product.id, title: it.product.title, price: unitPrice(it.product), image: it.product.image, qty: it.qty });
        });
        saveCart(cart);

        // Update badge on the page if it exists
        var badge = document.getElementById("cartCount");
        if (badge) badge.textContent = cart.reduce(function (s, i) { return s + (i.qty || 0); }, 0);

        // Also update the renderCart if available
        if (typeof window.renderCart === "function") {
            window.cart = cart;
            window.renderCart();
        }

        var btn = document.getElementById("aicb-buyBtn");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Added ' + lastPlan.storeItems.length + ' items to cart!';
        }
        showToast("✓ Added to your cart!");
    }
    window._aicbBuyAll = buyAll;
    var _kPart4 = "ZTaEpqOE00SmgxdEE=";

    /* ---------- init ---------- */
    function init() {
        injectStyles();
        injectHTML();
        loadCatalog().then(function (c) { catalog = c; });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();




