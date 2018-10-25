// File to filter out tasks that don't need to be built
var fs = require('fs');
var path = require('path');
var restClient = require('typed-rest-client/RestClient');
var httpHandler = require('typed-rest-client/Handlers');
var run = require('./ci-util').run;

var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString());

var getTasksToBuildFromVersioning = async function() {
    // Returns a list of tasks that have different version numbers than their current published version.
    var token = process.env['SYSTEM_ACCESSTOKEN'];
    var packageInfo;
    try {
        var handler = new httpHandler.PersonalAccessTokenCredentialHandler(token);
        var client = new restClient.RestClient('Tasks CI', '', [handler]);
        packageInfo = await client.get('https://mseng.feeds.visualstudio.com/_apis/packaging/Feeds/Codex-deps/Packages?packageNameQuery=Mseng.MS.TF.DistributedTask.Tasks');
        if (packageInfo.statusCode != 200) {
            return makeOptions.tasks;
        }
    }
    catch (err) {
        // If unable to reach rest client, build everything.
        return makeOptions.tasks;
    }
    var packageMap = {};
    packageInfo.result.value.forEach(package => {
        if (package.name && package.versions) {
            var packageName = package.name.slice('Mseng.MS.TF.DistributedTask.Tasks.'.length);
            var packageVersion = package.versions[0].version;
            package.versions.forEach(versionInfo => {
                if (versionInfo.isLatest) {
                    packageVersion = versionInfo.version;
                }
            });
            packageMap[packageName] = packageVersion;
        }
    });

    return makeOptions.tasks.filter(function (taskName) {
        if (taskName in packageMap) {
            var packageVersion = packageMap[taskName].split('.');
            var packageMajorVersion = packageVersion[0];
            var packageMinorVersion = packageVersion[1];
            var packagePatchVersion = packageVersion[2];

            var taskJsonPath = path.join(__dirname, '..', 'Tasks' , taskName, 'task.json')
            var taskJson = JSON.parse(fs.readFileSync(taskJsonPath).toString());
            var version = taskJson.version;
            if (packageMajorVersion != version.Major || packageMinorVersion != version.Minor || packagePatchVersion != version.Patch) {
                // If versions are not the same, want to build this package
                return true;
            }
        }
        return false;
    });
}

var getFilesUsingChangedCommon = function(commonFilePaths) {
    // Takes in an array of filepaths that have been changed in the Tasks/Common folder, returns any tasks that could be affected.
    if (commonFilePaths.length == 0) {
        return [];
    }
    changedTasks = [];
    makeOptions.tasks.forEach(taskName => {
        var makeJsonPath = path.join(__dirname, '..', 'Tasks' , taskName, 'make.json')
        if (fs.existsSync(makeJsonPath)){
            var makeJson = JSON.parse(fs.readFileSync(makeJsonPath).toString());
            if (makeJson.common) {
                makeJson.common.forEach(commonModule => {
                    if (commonFilePaths.includes(commonModule.module.toLowerCase()) && !changedTasks.includes(taskName)) {
                        changedTasks.push(taskName);
                    }
                });
            }
        }
    });
    return changedTasks;
}

var getTasksToBuildFromDiff = function() {
    // Takes in a git source branch, diffs it with master, and returns a list of tasks that could have been affected by the changes.
    var sourceBranch = process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH'];
    var prId = process.env['SYSTEM_PULLREQUEST_PULLREQUESTID'];
    var commonChanges = [];
    var toBeBuilt = [];
    run('git checkout master');
    run('git fetch origin pull/' + prId + '/head:' + sourceBranch);
    run('git diff --name-only master..' + sourceBranch).split('\n').forEach(filePath => {
        if (filePath.slice(0, 5) == 'Tasks') {
            var taskPath = filePath.slice(6);
            if(taskPath.slice(0, 6) == 'Common') {
                var commonName = taskPath.slice(7);
                commonChanges.push('../common/' + commonName.slice(0, commonName.indexOf('/')).toLowerCase());
            }
            else {
                var taskName = taskPath.slice(0, taskPath.indexOf('/'));
                if (!toBeBuilt.includes(taskName)) {
                    toBeBuilt.push(taskName);
                }
            }
        }
        else if (filePath.slice(0, 5) == 'Tests') {
            buildCommon = true;
        }
    });
    run('cd ..');
    var changedTasks = getFilesUsingChangedCommon(commonChanges);
    var shouldBeBumped = [];
    changedTasks.forEach(task => {
        if (!toBeBuilt.includes(task)) {
            shouldBeBumped.push(task);
        }
    });
    if (shouldBeBumped.length > 0) {
        throw new Error('The following tasks should have their versions bumped due to changes in common: ' + shouldBeBumped);
    }
    return toBeBuilt;
}

var setTaskVariables = function(tasks) {
    console.log('tasks: ' + JSON.stringify(tasks));
    console.log('##vso[task.setVariable variable=task_pattern]@(' + tasks.join('|') + ')');
    console.log('##vso[task.setVariable variable=numTasks]' + tasks.length);
}

var buildReason = process.env['BUILD_REASON'].toLowerCase();
var tasks;
if (buildReason == 'individualci' || buildReason == 'batchedci') {
    // If CI, we will compare any tasks that have updated versions.
    getTasksToBuildFromVersioning().then(tasks => {
        setTaskVariables(tasks)
    });
}
else {
    if (buildReason == 'pullrequest') {
        // If PR, we will compare any tasks that could have been affected based on the diff.
        tasks = getTasksToBuildFromDiff();
        setTaskVariables(tasks);
    }
    else {
        // If manual or other, build everything.
        setTaskVariables(makeOptions.tasks);
    }
}