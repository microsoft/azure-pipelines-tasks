// Filter out tasks that don't need to be built. Determines which tasks need to be built based on the type of build.
// If its a CI build, all tasks whose package numbers have been bumped will be built.
// If its a PR build, all tasks that have been changed will be built.
// Any other type of build will build all tasks.
var fs = require('fs');
var fetch = require('node-fetch');
var os = require('os');
var path = require('path');
var semver = require('semver');
var restClient = require('typed-rest-client/RestClient');
var httpHandler = require('typed-rest-client/Handlers');
var run = require('./ci-util').run;

var makeOptionsPath = path.join(__dirname, '..', 'make-options.json');
var makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath).toString());

var getTasksToBuildForCI = async function() {
    // Returns a list of tasks that have different version numbers than their current published version.
    var packageInfo;
    try {
        var packageToken = process.env['PACKAGE_TOKEN'];
        if (!packageToken) {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=21;]Failed to get info from package endpoint because no token was provided. Try setting the PACKAGE_TOKEN environment variable.`);
            return makeOptions.tasks;
        }
        var handler = new httpHandler.PersonalAccessTokenCredentialHandler(packageToken);
        var client = new restClient.RestClient('azure-pipelines-tasks-ci', '', [handler]);
        var packageEndpoint = process.env['PACKAGE_ENDPOINT'];
        if (!packageEndpoint) {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=28;]Failed to get info from package endpoint because no endpoint was specified. Try setting the PACKAGE_ENDPOINT environment variable.`);
            return makeOptions.tasks;
        }
        packageInfo = await client.get(packageEndpoint);
        if (packageInfo.statusCode !== 200) {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=33;]Failed to get info from package endpoint, returned with status code ${packageInfo.statusCode}`);
            return makeOptions.tasks;
        }
    } catch (err) {
        // If unable to reach rest client, build everything.
        console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=39;]Failed to get info from package endpoint, client failed with error ${err.message}`);
        return makeOptions.tasks;
    }
    var packageMap = {};
    if (!packageInfo.result || !packageInfo.result.value) {
        console.log('##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=44;]Failed to get info from package endpoint, returned no packages');
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
        }
    });

    return makeOptions.tasks.filter(function (taskName) {
        var taskJsonPath = path.join(__dirname, '..', 'Tasks' , taskName, 'task.json');
        if (fs.existsSync(taskJsonPath)){
            var taskJson = JSON.parse(fs.readFileSync(taskJsonPath).toString());
            var lowerCaseName = taskJson.name.toLowerCase();
            if (isNaN(parseInt(lowerCaseName.slice(-1), 10))) {
                lowerCaseName += "v" + taskJson.version.Major;
            }
            if (lowerCaseName in packageMap || taskName.toLowerCase() in packageMap) {
                if (taskName.toLowerCase() in packageMap) {
                    lowerCaseName = taskName.toLowerCase();
                }
                var packageVersion = packageMap[lowerCaseName];
                var localVersion = `${taskJson.version.Major}.${taskJson.version.Minor}.${taskJson.version.Patch}`;

                // Build if local version and package version are different.
                return semver.neq(localVersion, packageVersion);
            } else {
                console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=74;]${taskName} has not been published before`);
                return true;
            }
        } else {
            console.log(`##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=79;]${taskJsonPath} does not exist`);
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

async function getPullRequestBranches (pullRequestId) {
    const response = await fetch(`https://api.github.com/repos/microsoft/azure-pipelines-tasks/pulls/${pullRequestId}`);
    const data = await response.json();
    return { source: data.head.ref, target: data.base.ref };
}

async function getTasksToBuildForPR (prId, forDowngradingCheck) {
    // Takes in a git source branch, diffs it with master, and returns a list of tasks that could have been affected by the changes.
    let sourceBranch, targetBranch;

    if (prId) {
        const branches = await getPullRequestBranches(prId);
        sourceBranch = branches.source;
        targetBranch = branches.target;
    } else {
        prId = process.env['SYSTEM_PULLREQUEST_PULLREQUESTNUMBER'];
        sourceBranch = process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH'];
        targetBranch = process.env['SYSTEM_PULLREQUEST_TARGETBRANCH'];
    }

    var commonChanges = [];
    var commonTestChanges = [];
    var toBeBuilt = [];

    // We need to escape # on Unix platforms since that turns the rest of the string into a comment
    if (os.platform() != 'win32') {
        sourceBranch = sourceBranch.replace(/#/gi, "\\#");
        targetBranch = targetBranch.replace(/#/gi, "\\#");
    }

    try {
        if (sourceBranch.includes(':')) {
            // We only care about the branch name, not the source repo
            sourceBranch = sourceBranch.split(':')[1];
        }
        run('git fetch origin pull/' + prId + '/head:' + sourceBranch);
    } catch (err) {
        // If unable to reach github, build everything.
        console.log('##vso[task.logissue type=warning;sourcepath=ci/filter-task.js;linenumber=125;]Unable to reach github, building all tasks', err);
        return makeOptions.tasks;
    }

    var baseCommit = run('git merge-base ' + sourceBranch + ' origin/' + targetBranch);
    
    var diffExtra = "";

    if(forDowngradingCheck)
    {
        if (os.platform() == 'win32') {
            diffExtra = " -- .  :^^**/_buildConfigs/**";
        } else {
            diffExtra = " -- .  :^**/_buildConfigs/**";
        }
    }

    run('git --no-pager diff --name-only ' + baseCommit + ' ' + sourceBranch + diffExtra).split('\n').forEach(filePath => {
        if (filePath.slice(0, 5) == 'Tasks') {
            var taskPath = filePath.slice(6);
            if(taskPath.slice(0, 6) == 'Common') {
                var commonName = taskPath.slice(7);
                if (taskPath.toLowerCase().indexOf('test') > -1) {
                    commonTestChanges.push('../common/' + commonName.slice(0, commonName.indexOf('/')).toLowerCase());
                } else {
                    commonChanges.push('../common/' + commonName.slice(0, commonName.indexOf('/')).toLowerCase());
                }
            } else {
                var taskName = taskPath.slice(0, taskPath.indexOf('/'));
                if (!toBeBuilt.includes(taskName)) {
                    toBeBuilt.push(taskName);
                }
            }
        }

        // for downgrading check, include any changed generated tasks that have _ in the name (e.g. FtpUploadV1_Node20)
        if(forDowngradingCheck && filePath.slice(0, 10) == "_generated") {
            var taskPath = filePath.slice(11);
            var taskName = taskPath.slice(0, taskPath.indexOf('/'));
            if (!toBeBuilt.includes(taskName) && taskName.indexOf('_') > -1) {
                toBeBuilt.push(taskName);
            }
        }
    });
    var changedTasks = getTasksDependentOnChangedCommonFiles(commonChanges);
    var changedTests = getTasksDependentOnChangedCommonFiles(commonTestChanges);
    var shouldBeBumped = [];
    changedTasks.forEach(task => {
        if (!toBeBuilt.includes(task)) {
            shouldBeBumped.push(task);
            toBeBuilt.push(task);
        }
    });

    var skipBumpingVersionsDueToChangesInCommon = process.env['SKIPBUMPINGVERSIONSDUETOCHANGESINCOMMON'].toLowerCase() == 'true';

    if (shouldBeBumped.length > 0 && !skipBumpingVersionsDueToChangesInCommon) {
        throw new Error(`The following tasks should have their versions bumped due to changes in common: ${shouldBeBumped}`);
    }

    changedTests.forEach(task => {
        if (!toBeBuilt.includes(task)) {
            toBeBuilt.push(task);
        }
    });

    // Filter out fully removed tasks
    toBeBuilt = toBeBuilt.filter((taskName) => fs.existsSync(path.join(__dirname, '..', 'Tasks' , taskName)));

    return toBeBuilt;
}

var setTaskVariables = function(tasks, tasksForDowngradingCheck) {
    console.log('tasks: ' + JSON.stringify(tasks));
    console.log('tasksForDowngradingCheck: ' + JSON.stringify(tasksForDowngradingCheck));
    console.log('##vso[task.setVariable variable=task_pattern]@(' + tasks.join('|') + ')');
    console.log('##vso[task.setVariable variable=task_pattern_fordowngradingcheck]@(' + tasksForDowngradingCheck.join('|') + ')');
    console.log('##vso[task.setVariable variable=numTasks]' + tasks.length);
}

var buildReason = process.env['BUILD_REASON'].toLowerCase();
var forceCourtesyPush = process.env['FORCE_COURTESY_PUSH'] && process.env['FORCE_COURTESY_PUSH'].toLowerCase() === 'true';

async function filterTasks () {
    try {
        if (buildReason == 'individualci' || buildReason == 'batchedci' || buildReason == 'schedule' || forceCourtesyPush) {
            // If CI, we will compare any tasks that have updated versions.
            const tasks = await getTasksToBuildForCI();
            setTaskVariables(tasks, tasks);
        } else {
            const buildSourceBranch = process.env['BUILD_SOURCEBRANCH'];
            // If CI for PR, the `Build.SourceBranch` pipeline variable == `refs/pull/${prId}/merge`
            const regex = /^refs\/pull\/(\d+)\/merge$/;
            const prIdMatch = buildSourceBranch.match(regex);

            if (buildReason == 'pullrequest') {
                // If PR, we will compare any tasks that could have been affected based on the diff.
                const tasks = await getTasksToBuildForPR(null, false);
                const tasksForDowngradingCheck = await getTasksToBuildForPR(null, true);
                setTaskVariables(tasks, tasksForDowngradingCheck);
            } else if (buildReason == 'manual' && prIdMatch) {
                // Manual rerun for PR.
                const prId = prIdMatch[1];
                const tasks = await getTasksToBuildForPR(prId, false);
                const tasksForDowngradingCheck = await getTasksToBuildForPR(prId, true);
                setTaskVariables(tasks, tasksForDowngradingCheck);
            } else {
                // If other, build everything.
                setTaskVariables(makeOptions.tasks, makeOptions.tasks);
            }
        }
    } catch (error) {
        console.log(`##vso[task.logissue type=error]${error}`);
        console.log('##vso[task.complete result=Failed;]');
    }
}

filterTasks();
