var fs = require('fs');
var path = require('path');

const tasks = []  // get list of tasks

console.log(fs.readFileSync(path.resolve(__dirname, '..', '..', 'make-options.json'), 'utf8'))