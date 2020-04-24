var path = require('path');
var util = require('./ci-util');

// initialize _package
util.initializePackagePath();

if (process.argv.length > 2 && process.argv[1] === 'individually') {
    // Create all the task.zip files for each task
    util.createIndividualTaskZipFiles(/*omitLayoutVersion:*/true);
}
else {
    // Create the tasks.zip
    util.createTasksZip();
}