var fs = require('fs');
var semver = require('semver');
var path = require('path');
var process = require("process");
var util = require('./ci-util');

var expectedPackageLocVersion = "1.0.0";

taskList = util.resolveTaskList(process.argv[2]);

console.log(`Checking tasks package-lock version...`);
taskList.forEach(function(taskName) {
    console.log(`====================${taskName}====================`);
    var taskSourcePath = path.join(util.tasksSourcePath, taskName);
    
    var packageLockJsonPath = path.join(taskSourcePath, 'package-lock.json');
    if (fs.existsSync(packageLockJsonPath)) {
        var packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath));
        if (!semver.eq(packageLockJson.version, expectedPackageLocVersion)) {
            throw new Error(`Expected package-lock version should be ${expectedPackageLocVersion} (${taskSourcePath})`);
        }
    
        console.log(`Package-lock version is correct (${taskSourcePath})`);
    } else {
        console.log(`Package-lock doesn't exist (${taskSourcePath})`);
    }

    console.log(`Done`);
});
