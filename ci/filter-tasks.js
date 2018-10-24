var fs = require('fs');
var path = require('path');

var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString());
var buildReason = process.env['BUILD_REASON'].toLowerCase();
var filterFunction;
if (buildReason == 'individualci' || buildReason == 'batchedci') {
    // If CI, we will compare any tasks that have updated versions.
    // TODO - query REST endpoint. 
    filterFunction = function (val, index) {
        // TODO - If not able to access endpoint, return true. If able to access endpoint, compare version numbers here.
        return false;
    }
}
else if (buildReason == 'pullrequest') {
    // If PR, we will compare any tasks that could have been affected based on the diff.
    var buildAll = false;
    var buildCommon = false;
    var toBeBuilt = [];
    run('git fetch master');
    var sourceBranch = process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH'];
    run('git fetch ' + sourceBranch);
    run('git diff --name-only master..' + sourceBranch).split('\n').forEach(filePath => {
        if (filePath.slice(0, 5) == 'Tasks') {
            var taskPath = filePath.slice(6);
            if(taskPath.slice(0, 6) == 'Common') {
                buildCommon = true;
            }
            else {
                var taskName = taskPath.slice(0, taskPath.indexOf('/'));
                if (!toBeBuilt.includes(taskName)) {
                    toBeBuilt.push(taskName);
                }
            }
        }
        else if (filePath.slice(0, 5)== 'Tests') {
            buildCommon = true;
        }
    });

    if (buildCommon) {
        makeOptions.usingCommon.forEach(taskName => {
            if (!toBeBuilt.includes(taskName)) {
                toBeBuilt.push(taskName);
            }
        });
    }

    filterFunction = function (val, index) {
        if (toBeBuilt.includes(val)) {
            return true;
        }
    }
}
else {
    // If manual or other, build everything
    filterFunction = function (val, index) {
        return true;
    }
}

var tasks = makeOptions.tasks.filter(filterFunction);
console.log('tasks: ' + JSON.stringify(tasks));
console.log('##vso[task.setVariable variable=task_pattern]@(' + tasks.join('|') + ')');
console.log('##vso[task.setVariable variable=num_tasks]@(' + tasks.length + ')');