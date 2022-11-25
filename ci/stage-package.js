const util = require('./ci-util');

const hotfix = process.argv[2].toLowerCase() == 'true';
const individually = process.argv[3] == 'individually';

if (individually) {
    // initialize _package
    util.initializePackagePath();
    // Create all the task.zip files for each task
    util.createIndividualTaskZipFiles(/*omitLayoutVersion:*/!hotfix);
} else {
    // create the tasks.zip
    util.createTasksZip();
}
