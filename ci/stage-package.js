var path = require('path');
var util = require('./ci-util');

if (process.argv.length > 2 && process.argv[2] === 'individually') {
    // initialize _package
    util.initializePackagePath();
    // Create all the task.zip files for each task
    util.createIndividualTaskZipFiles(/*omitLayoutVersion:*/true);
}
else {
    // Create the tasks.zip
    util.createTasksZip();
}