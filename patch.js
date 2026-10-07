function buildMessages(userPrompt) {
    var system =
        "You are the friendly project assistant chatbot of 'Arduino Hub', an electronics store. " +
        "The user describes an electronics / Arduino / ESP32 / robotics project idea. " +
        "Work out every component needed.\n\n" +
        "RULES:\n" +
        "- Reply with ONE valid JSON object only, no markdown, no extra text.\n" +
        "- Write all human-readable text in the SAME language as the user (Arabic or English). JSON keys stay English.\n" +
        "- 'components_needed': list every electronic component, module, or hardware piece required.\n" +
        "- Quantities 1-20. Keep realistic.\n" +
        "- If the request is not electronics, return empty array and explain politely in 'overview'.\n\n" +
        "JSON SHAPE:\n" +
        "{\n  \"project_title\": \"string\",\n  \"overview\": \"2-3 sentences\",\n  \"steps\": [\"3-6 short steps\"],\n  \"components_needed\": [{\"name\": \"generic component name (e.g. Arduino Uno, 10k Resistor)\", \"qty\": 1, \"reason\": \"why\"}]\n}";

    return [
        { role: "system", content: system },
        { role: "user",   content: userPrompt }
    ];
}

function findProduct(item) {
    if (item.id) { var byId = catalog.find(function (p) { return String(p.id) === String(item.id); }); if (byId) return byId; }
    var name = String(item.name || "").toLowerCase().trim();
    if (!name) return null;
    
    var exact = catalog.find(function (p) { return (p.title || "").toLowerCase() === name; });
    if (exact) return exact;

    var words = name.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(function(w){ return w.length > 1; });
    if (!words.length) return null;

    var bestMatch = null;
    var bestScore = 0;
    
    catalog.forEach(function(p) {
        var pTitle = (p.title || "").toLowerCase();
        var matches = 0;
        words.forEach(function(w) {
            if (pTitle.indexOf(w) > -1) matches++;
        });
        if (matches > 0) {
            var score = (matches / words.length) - (pTitle.length * 0.001);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = p;
            }
        }
    });
    
    return bestScore > 0.3 ? bestMatch : null;
}

function normalizePlan(raw) {
    var merged = {}, extra = [];
    var allItems = (Array.isArray(raw.components_needed) ? raw.components_needed : [])
        .concat(Array.isArray(raw.store_items) ? raw.store_items : [])
        .concat(Array.isArray(raw.other_items) ? raw.other_items : []);

    allItems.forEach(function (it) {
        var product = findProduct(it);
        var qty = Math.min(20, Math.max(1, parseInt(it.qty, 10) || 1));
        if (product) {
            if (merged[product.id]) merged[product.id].qty = Math.min(20, merged[product.id].qty + qty);
            else merged[product.id] = { product: product, qty: qty, reason: it.reason || "" };
        } else if (it.name) { extra.push({ name: it.name, qty: qty, reason: it.reason || "" }); }
    });
    return {
        title: raw.project_title || "Your project",
        overview: raw.overview || "",
        steps: Array.isArray(raw.steps) ? raw.steps : [],
        storeItems: Object.values(merged),
        otherItems: extra
    };
}
