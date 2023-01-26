const fs = require('fs');
const path = require('path');


var args = process.argv.slice(2);

var content = JSON.parse(fs.readFileSync(args[0]));

console.log(content.id);