var path = require('path');
var process = require("process");
var util = require('./ci-util');

taskList = util.resolveTaskList(process.argv[2]);

console.log(`Checking tasks sources for uncommitted changes...`);
taskList.forEach(function(taskName) {
    console.log(`====================${taskName}====================`);

    var taskSourcePath = path.join(util.tasksSourcePath, taskName);

    var diffString = util.run(`git diff --name-only ${taskSourcePath}`);
    var diffList = diffString.split("\n").filter(Boolean);
    if (diffList.length) {
        throw new Error(`Uncommitted changes found (${taskSourcePath})`);
    };

    console.log(`No uncommitted changes found (${taskSourcePath})`);
    console.log(`Done`);
});
