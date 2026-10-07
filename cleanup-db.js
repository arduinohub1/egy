const fs = require('fs');

async function cleanupDB() {
    let products = [];
    let pageToken = "";
    
    console.log("Fetching products from Firestore...");
    do {
        let url = `https://firestore.googleapis.com/v1/projects/arduinohubfinal/databases/(default)/documents/products?pageSize=300`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) {
            console.error("Firestore Error:", data.error.message);
            if (data.error.code === 429) console.error("Daily Quota Exceeded. Try again tomorrow.");
            return;
        }
        
        if (data.documents) {
            products.push(...data.documents);
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    const seenTitles = {};
    const toDelete = [];
    
    const industrialKeywords = [
        'industrial', 'heavy duty', 'contactor', 'three-phase', 'cnc machinery', 
        'factory automation', 'large transformer', 'professional machinery', 'plc controller'
    ];

    products.forEach(doc => {
        const id = doc.name.split('/').pop();
        const title = doc.fields.title?.stringValue || "";
        const image = doc.fields.image?.stringValue || "";
        const hasOfferPrice = doc.fields.offerPrice && doc.fields.offerPrice.stringValue !== "";
        
        const isManual = image.startsWith('data:image') || hasOfferPrice;
        const titleKey = title.trim().toLowerCase();

        // Check exact duplicate
        if (seenTitles[titleKey]) {
            toDelete.push(id);
        } else {
            seenTitles[titleKey] = true;
            
            // Check industrial (ONLY if not manual)
            if (!isManual) {
                let isIndustrial = false;
                for(let kw of industrialKeywords) {
                    if (titleKey.includes(kw)) {
                        isIndustrial = true;
                        break;
                    }
                }
                if (isIndustrial) {
                    toDelete.push(id);
                }
            }
        }
    });

    console.log(`Found ${toDelete.length} items to delete.`);
    if (toDelete.length === 0) return;

    console.log("Deleting...");
    let deletedCount = 0;
    for (let id of toDelete) {
        const delUrl = `https://firestore.googleapis.com/v1/projects/arduinohubfinal/databases/(default)/documents/products/${id}`;
        await fetch(delUrl, { method: 'DELETE' });
        deletedCount++;
        if (deletedCount % 10 === 0) console.log(`Deleted ${deletedCount}/${toDelete.length}`);
    }
    
    console.log("Database cleanup complete. Protected all manual images and kept only university components.");
}

cleanupDB().catch(console.error);
