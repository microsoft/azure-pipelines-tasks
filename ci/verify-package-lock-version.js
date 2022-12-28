const fs = require('fs');
const semver = require('semver');
const path = require('path');
const process = require("process");
const util = require('./ci-util');

var expectedPackageLocVersion = "1.0.0";

taskList = util.resolveTaskList(process.argv[2]);
taskList.forEach(function(taskName) {
    var taskSourcePath = path.join(util.tasksSourcePath, taskName);
    
    var packageLockJsonPath = path.join(taskSourcePath, 'package-lock.json');
    if (!fs.existsSync(packageLockJsonPath)) {
        throw new Error(`Unable to find package-lock.json (${taskSourcePath})`);
    }

    var packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath));
    if (!semver.eq(packageLockJson.version, expectedPackageLocVersion)) {
        throw new Error(`Expected package-lock version should be ${expectedPackageLocVersion} (${taskSourcePath})`);
    }

    console.log(`Package-lock version is correct (${taskSourcePath})`);
});
