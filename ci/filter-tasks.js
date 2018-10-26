// Filter out tasks that don't need to be built. Determines which tasks need to be built based on the type of build.
// If its a CI build, all tasks whose package numbers have been bumped will be built.
// If its a PR build, all tasks that have been changed will be built.
// Any other type of build will build all tasks.
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var restClient = require('typed-rest-client/RestClient');
var httpHandler = require('typed-rest-client/Handlers');
var run = require('./ci-util').run;

var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString());

var getTasksToBuildForCI = async function() {
    // Returns a list of tasks that have different version numbers than their current published version.
    var token = process.env['SYSTEM_ACCESSTOKEN'];
    var packageInfo;
    try {
        var handler = new httpHandler.PersonalAccessTokenCredentialHandler(token);
        var client = new restClient.RestClient('Tasks CI', '', [handler]);
        packageInfo = await client.get(process.env['PACKAGE_ENDPOINT']);
        if (packageInfo.statusCode != 200) {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=24;]Failed to get info from package endpoint, returned with status code ${packageInfo.statusCode}`);
            return makeOptions.tasks;
        }
    }
    catch (err) {
        // If unable to reach rest client, build everything.
        console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=30;]Failed to get info from package endpoint, client failed with error ${err.message}`);
        return makeOptions.tasks;
    }
    var packageMap = {};
    if(!packageInfo.result || !packageInfo.result.value) {
        console.log('##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=34;]Failed to get info from package endpoint, returned no packages');
        return makeOptions.tasks;
    }
    packageInfo.result.value.forEach(package => {
        if (package.name && package.versions) {
            var packageName = package.name.toLowerCase().slice('mseng.ms.tf.distributedtask.tasks.'.length);
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
        var lowerCaseName = taskName.toLowerCase();
        if (lowerCaseName in packageMap) {
            var packageVersion = packageMap[lowerCaseName]

            var taskJsonPath = path.join(__dirname, '..', 'Tasks' , taskName, 'task.json')
            var taskJson = JSON.parse(fs.readFileSync(taskJsonPath).toString());
            var localVersion = `${taskJson.version.Major}.${taskJson.version.Minor}.${taskJson.version.Patch}`;
            
            if (semver.gt(localVersion, packageVersion)) {
                // If local version is greater than package version, want to build this package
                return true;
            }
            else if (semver.lt(localVersion, packageVersion)) {
                console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=63;]Package version ${localVersion} for ${taskName} is less than published version ${packageVersion}`);
            }
            return false;
        }
        else {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=68;]${taskName} has not been published before`);
            return true;
        }
    });
}

var getTasksDependentOnChangedCommonFiles = function(commonFilePaths) {
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

var getTasksToBuildForPR = function() {
    // Takes in a git source branch, diffs it with master, and returns a list of tasks that could have been affected by the changes.
    var sourceBranch = process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH'];
    var prId = process.env['SYSTEM_PULLREQUEST_PULLREQUESTID'];
    var commonChanges = [];
    var toBeBuilt = [];
    try {
        if (sourceBranch.contains(':')) {
            // We only care about the branch name, not the source repo
            sourceBranch = sourceBranch.split(':')[1];
        }
        run('git fetch origin pull/' + prId + '/head:' + sourceBranch);
        run ('git checkout ' + sourceBranch);
    }
    catch (err) {
        // If unable to reach github, build everything.
        console.log('##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=112;]Unable to reach github, building all tasks');
        return makeOptions.tasks;
    }
    run('git checkout master');
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
    });
    var changedTasks = getTasksDependentOnChangedCommonFiles(commonChanges);
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
    getTasksToBuildForCI().then(tasks => {
        setTaskVariables(tasks)
    });
}
else {
    if (buildReason == 'pullrequest') {
        // If PR, we will compare any tasks that could have been affected based on the diff.
        tasks = getTasksToBuildForPR();
        setTaskVariables(tasks);
    }
    else {
        // If manual or other, build everything.
        setTaskVariables(makeOptions.tasks);
    }
}