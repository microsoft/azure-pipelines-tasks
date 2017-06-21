import tl = require("vsts-task-lib/task");
var path = require('path');

var moduleJsonPath = path.join(__dirname, 'module.json');
tl.importLocStrings(moduleJsonPath);
