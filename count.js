const fs = require('fs');
const lines = fs.readFileSync('products.js', 'utf8').split('\n');
let depth = 0;
for(let i=776; i<lines.length; i++) {
    const l = lines[i];
    const open = (l.match(/\{/g) || []).length;
    const close = (l.match(/\}/g) || []).length;
    depth += open - close;
    if (depth === 0) console.log('Depth 0 at ' + (i+1));
}
