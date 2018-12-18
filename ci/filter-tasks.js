<<<<<<< HEAD
// File to filter out tasks that don't need to be built
var fs = require('fs');
var path = require('path');
=======
// Filter out tasks that don't need to be built. Determines which tasks need to be built based on the type of build.
// If its a CI build, all tasks whose package numbers have been bumped will be built.
// If its a PR build, all tasks that have been changed will be built.
// Any other type of build will build all tasks.
var fs = require('fs');
var path = require('path');
var semver = require('semver');
>>>>>>> upstream/master
var restClient = require('typed-rest-client/RestClient');
var httpHandler = require('typed-rest-client/Handlers');
var run = require('./ci-util').run;

var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString());

<<<<<<< HEAD
var getTasksToBuildFromVersioning = async function() {
    // Returns a list of tasks that have different version numbers than their current published version.
    var token = process.env['SYSTEM_ACCESSTOKEN'];
    var packageInfo;
    try {
        var handler = new httpHandler.PersonalAccessTokenCredentialHandler(token);
        var client = new restClient.RestClient('Tasks CI', '', [handler]);
        packageInfo = await client.get('https://mseng.feeds.visualstudio.com/_apis/packaging/Feeds/Codex-deps/Packages?packageNameQuery=Mseng.MS.TF.DistributedTask.Tasks');
        if (packageInfo.statusCode != 200) {
=======
var getTasksToBuildForCI = async function() {
    // Returns a list of tasks that have different version numbers than their current published version. 
    var packageInfo;
    try {
        var packageToken = process.env['PACKAGE_TOKEN'];
        if (!token) {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=24;]Failed to get info from package endpoint because no token was provided. Try setting the PACKAGE_TOKEN environment variable.`);
            return makeOptions.tasks;
        }
        var handler = new httpHandler.PersonalAccessTokenCredentialHandler(packageToken);
        var client = new restClient.RestClient('azure-pipelines-tasks-ci', '', [handler]);
        var packageEndpoint = process.env['PACKAGE_ENDPOINT'];
        if (!packageEndpoint) {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=24;]Failed to get info from package endpoint because no endpoint was specified. Try setting the PACKAGE_ENDPOINT environment variable.`);
            return makeOptions.tasks;
        }
        packageInfo = await client.get(packageEndpoint);
        if (packageInfo.statusCode !== 200) {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=24;]Failed to get info from package endpoint, returned with status code ${packageInfo.statusCode}`);
>>>>>>> upstream/master
            return makeOptions.tasks;
        }
    }
    catch (err) {
        // If unable to reach rest client, build everything.
<<<<<<< HEAD
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
=======
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
            var packageName = package.name.slice('Mseng.MS.TF.DistributedTask.Tasks.'.length).toLowerCase();
            packageMap[packageName] = package.versions[0].version;
            package.versions.some(versionInfo => {
                if (versionInfo.isLatest) {
                    packageMap[packageName] = versionInfo.version;
                    return true;
                }
                return false;
            });
>>>>>>> upstream/master
        }
    });

    return makeOptions.tasks.filter(function (taskName) {
<<<<<<< HEAD
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

var getTasksUsingChangedCommon = function(commonFilePaths) {
=======
        var lowerCaseName = taskName.toLowerCase();
        if (lowerCaseName in packageMap) {
            var packageVersion = packageMap[lowerCaseName]

            var taskJsonPath = path.join(__dirname, '..', 'Tasks' , taskName, 'task.json')
            var taskJson = JSON.parse(fs.readFileSync(taskJsonPath).toString());
            var localVersion = `${taskJson.version.Major}.${taskJson.version.Minor}.${taskJson.version.Patch}`;
            
            // Build if local version and package version are different.
            return semver.neq(localVersion, packageVersion);
        }
        else {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=68;]${taskName} has not been published before`);
            return true;
        }
    });
}

var getTasksDependentOnChangedCommonFiles = function(commonFilePaths) {
>>>>>>> upstream/master
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

<<<<<<< HEAD
var getTasksToBuildFromDiff = function() {
=======
var getTasksToBuildForPR = function() {
>>>>>>> upstream/master
    // Takes in a git source branch, diffs it with master, and returns a list of tasks that could have been affected by the changes.
    var sourceBranch = process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH'];
    var prId = process.env['SYSTEM_PULLREQUEST_PULLREQUESTID'];
    var commonChanges = [];
    var toBeBuilt = [];
<<<<<<< HEAD
    // Check if its from a fork
    if (sourceBranch.contains(':')) {
        sourceBranch = sourceBranch.split(':')[1];
        run('git fetch origin pull/' + prId + '/head:' + sourceBranch);
    }
    else {
        run('git fetch origin ' + sourceBranch);
    }
    run ('git checkout ' + sourceBranch);
=======
    try {
        if (sourceBranch.includes(':')) {
            // We only care about the branch name, not the source repo
            sourceBranch = sourceBranch.split(':')[1];
        }
        run('git fetch origin pull/' + prId + '/head:' + sourceBranch);
        run ('git checkout ' + sourceBranch);
    }
    catch (err) {
        // If unable to reach github, build everything.
        console.log('##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=112;]Unable to reach github, building all tasks', err);
        return makeOptions.tasks;
    }
>>>>>>> upstream/master
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
<<<<<<< HEAD
        else if (filePath.slice(0, 5) == 'Tests') {
            buildCommon = true;
        }
    });
    var changedTasks = getTasksUsingChangedCommon(commonChanges);
=======
    });
    var changedTasks = getTasksDependentOnChangedCommonFiles(commonChanges);
>>>>>>> upstream/master
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

<<<<<<< HEAD
var buildReason = process.env['BUILD_REASON'].toLowerCase();
var tasks;
if (buildReason == 'individualci' || buildReason == 'batchedci') {
    // If CI, we will compare any tasks that have updated versions.
    getTasksToBuildFromVersioning().then(tasks => {
=======
var buildReason = 'pullrequest';//process.env['BUILD_REASON'].toLowerCase();
var tasks;
if (buildReason == 'individualci' || buildReason == 'batchedci') {
    // If CI, we will compare any tasks that have updated versions.
    getTasksToBuildForCI().then(tasks => {
>>>>>>> upstream/master
        setTaskVariables(tasks)
    });
}
else {
    if (buildReason == 'pullrequest') {
        // If PR, we will compare any tasks that could have been affected based on the diff.
<<<<<<< HEAD
        tasks = getTasksToBuildFromDiff();
=======
        tasks = getTasksToBuildForPR();
>>>>>>> upstream/master
        setTaskVariables(tasks);
    }
    else {
        // If manual or other, build everything.
        setTaskVariables(makeOptions.tasks);
    }
}