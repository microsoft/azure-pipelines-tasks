var fs = require('fs');
var path = require('path');
var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString())
var jobCount = parseInt(process.env.SYSTEM_TOTALJOBSINPHASE || '1');
console.log(`Total jobs in phase: ${jobCount}`);
var jobNumber = parseInt(process.env.SYSTEM_JOBPOSITIONINPHASE || '1');
console.log(`Job position in phase: ${jobNumber}`);

// TODO: Fix this, call function to get tasks? In make.js? Or duplicate loading code.
var taskList = [];
    
// Tasks are stored in the format:
// { "name": "AndroidSigning", "build": false }
// We only want to add tasks to the list that have build set to true
var tasksFromFile = makeOptions.tasks;
tasksFromFile.forEach(function(taskFromFile) {
    if (taskFromFile.build) {
        taskList.push(task.name);
    }
});

var tasks = taskList.filter(function (val, index) {
    return index % jobCount == jobNumber - 1;
});

console.log('tasks: ' + JSON.stringify(tasks));
console.log('##vso[task.setVariable variable=task_pattern]@(' + tasks.join('|') + ')');
