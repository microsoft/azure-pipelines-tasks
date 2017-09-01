var fs = require('fs');
var path = require('path');
var util = require('./ci-util');

// load the task list
var makeOptionsPath = path.resolve(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString());
console.log(`Task count: ${makeOptions.tasks.length}`);

// create two mappings: task-to-common and common-to-task
console.log('Creating task-to-common and common-to-task mappings.');
var taskToCommon = {};
var commonToTask = {};
makeOptions.tasks.forEach(function (taskName) {
    taskToCommon[taskName] = [];
    var taskMakePath = path.resolve(__dirname, '..', 'Tasks', taskName, 'make.json');
    if (util.statOrNullSync(taskMakePath)) {
        var taskMake = JSON.parse(fs.readFileSync(taskMakePath).toString());
        if (taskMake.common) {
            taskMake.common.forEach(function (commonReference) {
                var commonName = path.basename(commonReference.module);
                taskToCommon[taskName].push(commonName);
                if (!commonToTask[commonName]) {
                    commonToTask[commonName] = [];
                }

                commonToTask[commonName].push(taskName);
            });
        }
    }

    console.log(`Task: ${taskName}, Common: ${taskToCommon[taskName].join(' ') || '(none)'}`);
});

// use the mappings to group tasks by common references, and calculate the weight of each group
console.log('Categorizing tasks into weighted groups.');
var groups = [];
Object.keys(taskToCommon).forEach(function (taskName) {
    // initialize the group
    var group = { weight: 0, taskNames: [] };

    // start walking the references
    var taskNamesToTraverse = [taskName];
    while (taskNamesToTraverse.length) {
        // test if already walked
        var taskName = taskNamesToTraverse.pop();
        if (!taskToCommon.hasOwnProperty(taskName)) {
            continue;
        }

        // count the task
        group.weight++;
        group.taskNames.push(taskName);
        var commonReferences = taskToCommon[taskName];
        delete taskToCommon[taskName];

        // walk common references
        commonReferences.forEach(function (commonName) {
            // test if already walked
            if (!commonToTask.hasOwnProperty(commonName)) {
                return;
            }

            // count the common module
            group.weight++;
            var referencedByTasks = commonToTask[commonName];
            delete commonToTask[commonName];

            // append task references
            taskNamesToTraverse = taskNamesToTraverse.concat(referencedByTasks);
        });
    }

    // push the group
    if (group.weight) {
        group.taskNames = group.taskNames.sort();
        groups.push(group);
    }
});

// sort the weighted groups
groups = groups.sort(function (a, b) {
    if (a.weight < b.weight) {
        return -1;
    } else if (a.weight > b.weight) {
        return 1;
    }

    var aTaskNames = a.taskNames.join(',');
    var bTaskNames = b.taskNames.join(',');
    if (aTaskNames < bTaskNames) {
        return -1;
    }

    return 1;
});
groups = groups.reverse();
groups.forEach(function (group) {
    console.log(`Group weight: ${group.weight}, tasks: ${group.taskNames.join(' ')}`);
});

// now that the weighted groups are sorted, re-organize into buckets
console.log('Organizing the weighted groups into buckets.');

// initialize the buckets
var buckets = [];
var bucketCount = parseInt(process.env.SYSTEM_TOTALJOBSINPHASE);
for (var i = 0; i < bucketCount; i++) {
    buckets.push({ weight: 0, taskNames: []});
}

// fill the buckets
groups.forEach(function (group) {
    // find the least weighted bucket
    var minWeight = Number.MAX_VALUE;
    var minBucket = null;
    buckets.forEach(function (bucket) {
        if (bucket.weight < minWeight) {
            minWeight = bucket.weight;
            minBucket = bucket;
        }
    });

    // add to the bucket
    minBucket.weight += group.weight;
    minBucket.taskNames = minBucket.taskNames.concat(group.taskNames);
});
for (var i = 0; i < bucketCount; i++) {
    console.log(`Bucket ${i + 1} weight: ${buckets[i].weight}, tasks: ${buckets[i].taskNames.join(' ')}`);
}

var bucketNumber = parseInt(process.env.SYSTEM_JOBPOSITIONINPHASE);
console.log(`Choosing bucket ${bucketNumber}`);
var taskNames = buckets[bucketNumber - 1].taskNames;
console.log('##vso[task.setVariable variable=task_pattern]@(' + taskNames.join('|') + ')');
