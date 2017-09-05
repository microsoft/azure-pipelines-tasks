var path = require('path');
var util = require('./ci-util');

// initialize _package
util.initializePackagePath();

// Create the tasks.zip
util.createTasksZip(/*omitLayoutVersion:*/true);
