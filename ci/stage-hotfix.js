var fs = require('fs');
var os = require('os');
var path = require('path');
var util = require('./ci-util');

if (process.argv.length > 2 && process.argv[2] === 'individually') {
    // initialize _package
    util.initializePackagePath();
    // Create all the task.zip files for each task
    util.createIndividualTaskZipFiles(/*omitLayoutVersion:*/false);
}
else {
    // create the tasks.zip
    util.createTasksZip();

    var branch = null;
    if (process.env.TF_BUILD) {
        // during CI agent checks out a commit, not a branch.
        // $(build.sourceBranch) indicates the branch name, e.g. releases/m108
        branch = process.env.BUILD_SOURCEBRANCH;
    }
    else {
        // assumes user has checked out a branch. this is a fairly safe assumption.
        // this code only runs during "package" and "publish" build targets, which
        // is not typically run locally.
        branch = util.run('git symbolic-ref HEAD');
    }

    var commitInfo = util.run('git log -1 --format=oneline');

    // create the script
    fs.mkdirSync(util.hotfixLayoutPath);
    var scriptPath = path.join(util.hotfixLayoutPath, `${process.env.TASK}.ps1`);
    var scriptContent = '# Hotfix created from branch: ' + branch + os.EOL;
    scriptContent += '# Commit: ' + commitInfo + os.EOL;
    scriptContent += '$ErrorActionPreference=\'Stop\'' + os.EOL;
    scriptContent += 'Update-DistributedTaskDefinitions -TaskZip $PSScriptRoot\\tasks.zip' + os.EOL;
    fs.writeFileSync(scriptPath, scriptContent);

    // link the non-aggregate tasks zip
    var zipDestPath = path.join(util.hotfixLayoutPath, 'tasks.zip');
    fs.linkSync(util.tasksZipPath, zipDestPath)
}
