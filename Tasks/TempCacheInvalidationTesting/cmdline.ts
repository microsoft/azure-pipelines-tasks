import fs = require('fs');
import path = require('path');
var taskPath = path.join(__dirname, 'task.json');
var task = JSON.parse(fs.readFileSync(taskPath).toString());
console.log(`version=${task.version.Major}.${task.version.Minor}.${task.version.Patch}`);
