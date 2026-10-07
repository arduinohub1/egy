const fs = require('fs');

async function upload() {
    const products = JSON.parse(fs.readFileSync('generated_products.json'));
    console.log(`Starting upload of ${products.length} products...`);
    let count = 0;
    
    for (let p of products) {
        const body = {
            fields: {
                title: { stringValue: p.title },
                category: { stringValue: p.category },
                price: { doubleValue: p.price },
                rating: { doubleValue: p.rating },
                isBestSeller: { booleanValue: p.isBestSeller },
                image: { stringValue: p.image }
            }
        };

        try {
            const res = await fetch("https://firestore.googleapis.com/v1/projects/arduinohubfinal/databases/(default)/documents/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                count++;
                if (count % 50 === 0) console.log(`Uploaded ${count}/${products.length}...`);
            } else {
                console.error(`Failed: ${res.statusText}`);
            }
        } catch (e) {
            console.error(e);
        }
        
        // Small delay to prevent rate limits
        await new Promise(r => setTimeout(r, 20));
    }
    
    console.log(`Done! Successfully uploaded ${count} products.`);
}

upload();
