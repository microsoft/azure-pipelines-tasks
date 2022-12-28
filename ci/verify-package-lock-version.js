var fs = require('fs');
var path = require('path');
var process = require("process");
var util = require('./ci-util');

var expectedPackageLocVersion = 1;

taskList = util.resolveTaskList(process.argv[2]);

console.log(`Checking tasks package-lock version...`);
taskList.forEach(function(taskName) {
    console.log(`====================${taskName}====================`);
    var taskSourcePath = path.join(util.tasksSourcePath, taskName);
    
    var packageLockJsonPath = path.join(taskSourcePath, 'package-lock.json');
    if (fs.existsSync(packageLockJsonPath)) {
        var packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath));
        var packageLockVersion = packageLockJson.lockfileVersion;
        if (parseInt(packageLockVersion) != expectedPackageLocVersion) {
            throw new Error(`Expected package-lock version should be ${expectedPackageLocVersion} got ${packageLockVersion} (${taskSourcePath})`);
        }
    
        console.log(`Package-lock version is correct (${taskSourcePath})`);
    } else {
        console.warn(`Package-lock doesn't exist (${taskSourcePath})`);
    }

    console.log(`Done`);
});
