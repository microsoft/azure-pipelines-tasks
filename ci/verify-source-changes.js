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
        console.log(``);
        console.log(`Uncommitted changes found:`);
        console.log(``);
        diffList.forEach(function(item){
            console.log(` - ${item}`);
        });
        console.log(``);
        console.log(`Please validate your changes locally. Make sure that you build tasks using an NPM version lower than 7`);
        console.log(``);

        process.exit(1);
    };

    console.log(`No uncommitted changes found`);
    console.log(``);
});
