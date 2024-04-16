var path = require('path');
var fs = require('fs');
var process = require("process");
var util = require('./ci-util');

// The filtered list of tasks to build is stored in $(task_pattern) environment variable
var taskPattern = process.argv[2];
if (!taskPattern) {
    console.log(`$(task_pattern) variable is empty or not set. Aborting...`);
    process.exit(0);
};

var taskList = util.resolveTaskList(taskPattern);
var allTasks = util.getAllTaskList(taskList);

var totalDiffList = [];

console.log(`Checking tasks sources for uncommitted changes...`);
console.log(``);
console.log(taskList)
allTasks.forEach(function(taskName) {
    console.log(`====================${taskName}====================`);

    var taskSourcePath = path.join(util.tasksSourcePath, taskName);
    console.log(taskSourcePath)

    // If the task source folder doesn't exist then it's generated task so need to check it
    if (!fs.existsSync(taskSourcePath)) {
        if (!fs.existsSync(util.genTaskPath, taskName)) return;

        taskSourcePath = path.join(util.genTaskPath, taskName);
    }

    var diffString = util.run(`git diff --name-only ${taskSourcePath}`);
    var diffList = diffString.split("\n").filter(Boolean);
    if (diffList.length) {
        console.log(``);
        console.log(`Uncommitted changes found:`);
        console.log(``);
        diffList.forEach(function(item){
            totalDiffList.push(item);
            console.log(` - ${item}`);
            console.log(``);
        });
    } else {
        console.log(``);
        console.log(`No uncommitted changes found`);
        console.log(``);
    };
});

if (totalDiffList.length) {
        console.log(``);
        console.log(`Please build your tasks locally and commit specified changes:`);
        console.log(``);

        totalDiffList.forEach(function(item){
            console.log(` - ${item}`);
        });

        console.log(``);
        console.log(`Make sure you are using Node 20 and NPM 9. For more details check our contribution guide - https://github.com/microsoft/azure-pipelines-tasks/blob/master/docs/contribute.md`);
        console.log(``);

        process.exit(1);
};
