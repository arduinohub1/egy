const fs = require('fs');

async function fixCategories() {
    console.log("Fetching all products...");
    let products = [];
    let pageToken = "";
    do {
        let url = `https://firestore.googleapis.com/v1/projects/arduinohubfinal/databases/(default)/documents/products?pageSize=300`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.documents) {
            products.push(...data.documents);
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`Found ${products.length} products. Analyzing categories...`);

    let updates = 0;
    for (let doc of products) {
        const title = (doc.fields.title && doc.fields.title.stringValue) ? doc.fields.title.stringValue : "";
        let currentCategory = (doc.fields.category && doc.fields.category.stringValue) ? doc.fields.category.stringValue : "";
        let newCategory = currentCategory;
        const titleLower = title.toLowerCase();

        // 1. Wires
        if (titleLower.includes('dupont') || titleLower.includes('jumper wire') || titleLower.includes('wire') || titleLower.includes('alligator clip') || titleLower.includes('test lead') || titleLower.includes('heat shrink')) {
            newCategory = 'Wires';
        }
        // 2. Power
        else if (titleLower.includes('power supply') || titleLower.includes('battery') || titleLower.includes('tp4056') || titleLower.includes('boost converter') || titleLower.includes('buck converter') || titleLower.includes('solar panel') || titleLower.includes('power adapter') || titleLower.includes('charger')) {
            newCategory = 'Power';
        }
        // 3. Motors
        else if (titleLower.includes('motor') || titleLower.includes('servo') || titleLower.includes('stepper') || titleLower.includes('pump') || titleLower.includes('actuator') || titleLower.includes('valve')) {
            newCategory = 'Motors';
        }
        // 4. Tools
        else if (titleLower.includes('multimeter') || titleLower.includes('soldering') || titleLower.includes('stripper') || titleLower.includes('tweezers') || titleLower.includes('tape') || titleLower.includes('standoff')) {
            newCategory = 'Tools';
        }
        // 5. Displays
        else if (titleLower.includes('lcd') || titleLower.includes('oled') || titleLower.includes('tft') || titleLower.includes('display') || titleLower.includes('led matrix')) {
            newCategory = 'Displays';
        }
        
        if (newCategory !== currentCategory) {
            console.log(`Updating '${title}': ${currentCategory} -> ${newCategory}`);
            
            // Reconstruct fields properly
            const fields = { ...doc.fields };
            fields.category = { stringValue: newCategory };

            const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=category`;
            
            try {
                const patchRes = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields: fields })
                });
                if (patchRes.ok) updates++;
            } catch(e) {
                console.error("Failed to patch:", title);
            }
            await new Promise(r => setTimeout(r, 20)); // rate limit
        }
    }
    console.log(`Done! Updated ${updates} products.`);
}

fixCategories();
