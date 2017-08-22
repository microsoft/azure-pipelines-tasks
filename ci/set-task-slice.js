var fs = require('fs');
var path = require('path');
var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString())
console.log('SYSTEM_TOTALJOBSINPHASE: ' + process.env.SYSTEM_TOTALJOBSINPHASE);
console.log('SYSTEM_JOBPOSITIONINPHASE: ' + process.env.SYSTEM_JOBPOSITIONINPHASE);
var tasks = makeOptions.tasks.filter(function (val, index) {
    return index % parseInt(process.env.SYSTEM_TOTALJOBSINPHASE) == parseInt(process.env.SYSTEM_JOBPOSITIONINPHASE) - 1;
});

console.log('tasks: ' + JSON.stringify(tasks));
console.log('##vso[task.setVariable variable=task_pattern]@(' + tasks.join('|') + ')');
