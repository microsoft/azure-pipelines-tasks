var path = require('path');
var process = require("process");
var util = require('./ci-util');

taskList = util.resolveTaskList(process.argv[2]);

var totalDiffList = [];

console.log(`Checking tasks sources for uncommitted changes...`);
taskList.forEach(function(taskName) {
    console.log(`====================${taskName}====================`);

    var taskSourcePath = path.join(util.tasksSourcePath, taskName);

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
        console.log(`Make sure that you using an NPM version lower than 7`);
        console.log(``);

        process.exit(1);
};
