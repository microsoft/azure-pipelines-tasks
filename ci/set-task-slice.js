var fs = require('fs');
var path = require('path');
var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString())
var jobCount = parseInt(process.env.SYSTEM_TOTALJOBSINPHASE || '1');
console.log(`Total jobs in phase: ${jobCount}`);
var jobNumber = parseInt(process.env.SYSTEM_JOBPOSITIONINPHASE || '1');
console.log(`Job position in phase: ${jobNumber}`);
var tasks = makeOptions.tasks.filter(function (val, index) {
    return index % jobCount == jobNumber - 1;
});

console.log('tasks: ' + JSON.stringify(tasks));
console.log('##vso[task.setVariable variable=task_pattern]@(' + tasks.join('|') + ')');
