const fs = require('fs');
const args = process.argv.slice(2);
const content = JSON.parse(fs.readFileSync(args[0]));

console.log(content.id);