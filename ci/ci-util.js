var fs = require('fs');
var path = require('path');
var ncp = require('child_process');
var semver = require('semver');

//------------------------------------------------------------------------------
// global paths
//------------------------------------------------------------------------------

var buildTasksPath = path.join(__dirname, '..', '_build', 'Tasks');
var packagePath = path.join(__dirname, '..', '_package');
var tasksLayoutPath = path.join(packagePath, 'tasks-layout');
var tasksZipPath = path.join(packagePath, 'tasks.zip');
var hotfixLayoutPath = path.join(packagePath, 'hotfix-layout');
var milestoneLayoutPath = path.join(packagePath, 'milestone-layout');
var milestonePackSourcePath = path.join(packagePath, 'milestone-pack-source');
var milestonePackSourceContentsPath = path.join(packagePath, 'milestone-pack-source', 'contents');
var milestoneNuspecPath = path.join(packagePath, 'vsts-tasks-milestone.nuspec');
var restorePath = path.join(packagePath, 'restore');
var aggregateLayoutPath = path.join(packagePath, 'aggregate-layout');
var aggregatePackSourcePath = path.join(packagePath, 'aggregate-pack-source');
var aggregatePackSourceContentsPath = path.join(packagePath, 'aggregate-pack-source', 'contents');
var aggregatePackSourceContentsZipPath = path.join(packagePath, 'aggregate-pack-source', 'contents', 'Microsoft.TeamFoundation.Build.Tasks.zip');
var aggregatePackageName = 'Mseng.MS.TF.Build.Tasks';
var aggregateNuspecPath = path.join(packagePath, 'Mseng.MS.TF.Build.Tasks.nuspec');
var publishLayoutPath = path.join(packagePath, 'publish-layout');
var publishPushCmdPath = path.join(packagePath, 'publish-layout', 'push.cmd');
exports.buildTasksPath = buildTasksPath;
exports.packagePath = packagePath;
exports.tasksLayoutPath = tasksLayoutPath;
exports.tasksZipPath = tasksZipPath;
exports.hotfixLayoutPath = hotfixLayoutPath;
exports.milestoneLayoutPath = milestoneLayoutPath;
exports.milestonePackSourcePath = milestonePackSourcePath;
exports.milestonePackSourceContentsPath = milestonePackSourceContentsPath;
exports.milestoneNuspecPath = milestoneNuspecPath;
exports.restorePath = restorePath;
exports.aggregateLayoutPath = aggregateLayoutPath;
exports.aggregatePackSourcePath = aggregatePackSourcePath;
exports.aggregatePackSourceContentsPath = aggregatePackSourceContentsPath;
exports.aggregatePackSourceContentsZipPath = aggregatePackSourceContentsZipPath;
exports.aggregatePackageName = aggregatePackageName;
exports.aggregateNuspecPath = aggregateNuspecPath;
exports.publishLayoutPath = publishLayoutPath;
exports.publishPushCmdPath = publishPushCmdPath;

//------------------------------------------------------------------------------
// generic functions
//------------------------------------------------------------------------------

var assert = function (value, name) {
    if (!value) {
        throw new Error('"' + name + '" cannot be null or empty.');
    }
}
exports.assert = assert;

var lstatOrNullSync = function (path) {
    assert(path, 'path');
    var lstats = null;
    try {
        lstats = fs.lstatSync(path);
    }
    catch (err) {
        if (err.code != 'ENOENT') {
            throw new Error(`Failed attempting to determine existence of path '${path}'. ${err.message}`);
        }
    }

    return lstats;
}
exports.lstatOrNullSync = lstatOrNullSync;

var statOrNullSync = function (path) {
    assert(path, 'path');
    var stats = null;
    try {
        stats = fs.statSync(path);
    }
    catch (err) {
        if (err.code != 'ENOENT') {
            throw new Error(`Failed attempting to determine existence of path '${path}'. ${err.message}`);
        }
    }

    return stats;
}
exports.statOrNullSync = statOrNullSync;

var run = function (cl, inheritStreams) {
    var options = {
        stdio: inheritStreams ? 'inherit' : 'pipe'
    };
    var rc = 0;
    var output;
    try {
        output = ncp.execSync(cl, options);
    }
    catch (err) {
        if (!inheritStreams) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        throw new Error(`The following command line failed: '${cl}'`);
    }

    output = (output || '').toString().trim();
    if (!inheritStreams) {
        console.log(output);
    }

    return output;
}
exports.run = run;

//------------------------------------------------------------------------------
// layout functions
//------------------------------------------------------------------------------

var initializePackagePath = function () {
    assert(packagePath, 'packagePath');
    if (process.platform != 'win32') {
        throw new Error(`Function 'initializePackagePath' not supported on platform '${process.platform}'.`);
    }

    var lstats = lstatOrNullSync(packagePath);
    if (lstats) {
        var originalWorkingDirectory;
        try {
            originalWorkingDirectory = process.cwd();
            process.chdir(path.dirname(packagePath));
            run(`rmdir /s /q ${path.basename(packagePath)}`, /*inheritStreams:*/true);
        }
        finally {
            if (originalWorkingDirectory) {
                process.chdir(originalWorkingDirectory);
            }
        }
    }

    fs.mkdirSync(packagePath);
}
exports.initializePackagePath = initializePackagePath;

var linkNonAggregateLayoutContent = function (sourceRoot, destRoot, metadataOnly) {
    assert(sourceRoot, 'sourceRoot');
    assert(destRoot, 'destRoot');
    var metadataFileNames = ['TASK.JSON', 'TASK.LOC.JSON', 'STRINGS', 'ICON.PNG'];
    // process each file/folder within the source root
    fs.readdirSync(sourceRoot).forEach(function (itemName) {
        var taskSourcePath = path.join(sourceRoot, itemName);
        var taskDestPath = path.join(destRoot, itemName);

        // skip the Common folder and skip files
        if (itemName == 'Common' || !fs.statSync(taskSourcePath).isDirectory()) {
            return;
        }

        // mkdir
        if (!lstatOrNullSync(taskDestPath)) {
            fs.mkdirSync(taskDestPath);
        }

        // process each file/folder within each task folder
        fs.readdirSync(taskSourcePath).forEach(function (itemName) {
            // skip the Tests folder
            if (itemName == 'Tests') {
                return;
            }

            // when metadataOnly=true, skip non-metadata items
            if (metadataOnly && metadataFileNames.indexOf(itemName.toUpperCase()) < 0) {
                return;
            }

            // create a junction point for directories, hardlink files
            var itemSourcePath = path.join(taskSourcePath, itemName);
            var itemDestPath = path.join(taskDestPath, itemName);
            if (fs.statSync(itemSourcePath).isDirectory()) {
                fs.symlinkSync(itemSourcePath, itemDestPath, 'junction');
            }
            else {
                fs.linkSync(itemSourcePath, itemDestPath);
            }
        });
    });
}

var linkAggregateLayoutContent = function (sourceRoot, destRoot, release, commit, taskDestMap) {
    assert(sourceRoot, 'sourceRoot');
    assert(destRoot, 'destRoot');
    assert(commit, 'commit');
    console.log();
    console.log(`> Linking ${sourceRoot}`);

    // process each file/folder within the non-aggregate layout
    fs.readdirSync(sourceRoot).forEach(function (itemName) {
        // skip files
        var taskSourcePath = path.join(sourceRoot, itemName);
        if (!fs.statSync(taskSourcePath).isDirectory()) {
            return;
        }

        // load the source task.json
        var sourceTask = JSON.parse(fs.readFileSync(path.join(taskSourcePath, 'task.json')));
        if (typeof sourceTask.version.Major != 'number' ||
            typeof sourceTask.version.Minor != 'number' ||
            typeof sourceTask.version.Patch != 'number') {

            throw new Error(`Expected task.version.Major/Minor/Patch to be numbers (${taskSourcePath})`);
        }

        // determine the dest folder based on the major version
        assert(sourceTask.id, 'sourceTask.id');
        var taskDestKey = sourceTask.id + '@' + sourceTask.version.Major;
        var taskDestPath = taskDestMap[taskDestKey];
        if (!taskDestPath) {
            taskDestPath = path.join(destRoot, itemName + `__v${sourceTask.version.Major}`);
            taskDestMap[taskDestKey] = taskDestPath;
        }

        if (statOrNullSync(taskDestPath)) {
            // validate that a newer minor+patch does not exist in an older release
            // (newer releases should be linked first)
            var destTask = JSON.parse(fs.readFileSync(path.join(taskDestPath, 'task.json')));
            var sourceVersion = `${sourceTask.version.Major}.${sourceTask.version.Minor}.${sourceTask.version.Patch}`;
            var destVersion = `${destTask.version.Major}.${destTask.version.Minor}.${destTask.version.Patch}`;
            if (semver.gt(sourceVersion, destVersion)) {
                throw new Error(`Expected minor+patch version for task already in the aggregate layout, to be greater or equal than non-aggregate layout being merged. Source task: ${taskSourcePath}`);
            }
        }
        else {
            // create a junction point
            fs.symlinkSync(taskSourcePath, taskDestPath, 'junction');

            // write a human-friendly metadata file
            fs.writeFileSync(taskDestPath + (release ? `_m${release}` : '') + `_${commit}`, '');
        }
    });
}
exports.linkAggregateLayoutContent = linkAggregateLayoutContent;

var getRefs = function () {
    console.log();
    console.log('> Getting branch/commit info')
    var info = {};
    var branch;
    if (process.env.TF_BUILD) {
        // during CI agent checks out a commit, not a branch.
        // $(build.sourceBranch) indicates the branch name, e.g. releases/m108
        branch = process.env.BUILD_SOURCEBRANCH;
    }
    else {
        // assumes user has checked out a branch. this is a fairly safe assumption.
        // this code only runs during "package" and "publish" build targets, which
        // is not typically run locally.
        branch = run('git symbolic-ref HEAD');
    }

    assert(branch, 'branch');
    var commit = run('git rev-parse --short=8 HEAD');
    var release;
    if (branch.match(/^(refs\/heads\/)?releases\/m[0-9]+$/)) {
        release = parseInt(branch.split('/').pop().substr(1));
    }

    // get the ref info for HEAD
    var info = {
        head: {
            branch: branch,  // e.g. refs/heads/releases/m108
            commit: commit,  // leading 8 chars only
            release: release // e.g. 108 or undefined if not a release branch
        },
        releases: {}
    };

    var headIntersectionWithMaster = null;

    // get the ref info for each release branch within range
    run('git branch --list --remotes "origin/releases/m*"')
        .split('\n')
        .forEach(function (branch) {
            branch = branch.trim();
            if (!branch.match(/^origin\/releases\/m[0-9]+$/)) {
                return;
            }

            var release = parseInt(branch.split('/').pop().substr(1));

            // filter out releases less than 108 and greater than HEAD
            if (release < 108 ||
                release > (info.head.release || 999)) {

                return;
            }

            // when not building a release branch, leverage the git graph to determine which release branches to include.
            // filter out releases where the intersection with master is ahead of (or equal to) HEAD's intersection with master
            // example:
            //   master
            //   |
            //   |    releases/m122 // should be filtered out
            //   |    |
            //   |-----    releases/m121 // should be filtered out
            //   |         |
            //   |         |    releases/tfs2018rc1 (HEAD)
            //   |         |    |
            //   |         |-----
            //   |         |
            //   |----------         releases/m120 // should be included
            //   |                   |
            //   |--------------------
            //   |
            if (!info.head.release) {
                // determine the commit where HEAD intersects with master
                if (!headIntersectionWithMaster) {
                    headIntersectionWithMaster = run('git merge-base HEAD origin/master');
                    assert(headIntersectionWithMaster, 'headIntersectionWithMaster');
                }

                // determine the commit where the release branch intersects with origin/master
                var releaseIntersectionWithMaster = run(`git merge-base ${branch} origin/master`);
                assert(releaseIntersectionWithMaster, 'releaseIntersectionWithMaster');

                // determine whether the commit head-intersection-with-master is ahead of the commit release-branch-intersection-with-master
                var isPreviousReleaseBranch = run(`git rev-list --max-count 1 ${releaseIntersectionWithMaster}..${headIntersectionWithMaster}`);
                if (!isPreviousReleaseBranch) {
                    // the commit release-branch-intersection-with-master is ahead of (or equal to) the commit head-intersection-with-master
                    return;
                }
            }

            branch = 'refs/remotes/' + branch;
            var commit = run(`git rev-parse --short=8 "${branch}"`);
            info.releases[release] = {
                branch: branch,
                commit: commit,
                release: release
            };
        });

    return info;
}
exports.getRefs = getRefs;

var compressTasks = function (sourceRoot, targetPath, individually) {
    assert(sourceRoot, 'sourceRoot');
    assert(targetPath, 'targetPath');
    run(`powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command "& '${path.join(__dirname, 'compress-tasks.ps1')}' -SourceRoot '${sourceRoot}' -TargetPath '${targetPath}' -Individually:${individually ? '$true' : '$false'}"`,
        /*inheritStreams:*/true);
}
exports.compressTasks = compressTasks;

var expandTasks = function (zipPath, targetPath) {
    assert(zipPath, 'zipPath');
    assert(targetPath, 'targetPath');
    run(`powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command "& '${path.join(__dirname, 'expand-tasks.ps1')}' -ZipPath '${zipPath}' -TargetPath '${targetPath}'"`,
        /*inheritStreams:*/true);
}
exports.expandTasks = expandTasks;

var createIndividualTaskZipFiles = function (omitLayoutVersion) {
    // build the layout for the nested task zips
    console.log();
    console.log('> Linking content for nested zips layout');
    var nestedZipsLayoutPath = path.join(packagePath, 'nested-zips-layout');
    fs.mkdirSync(nestedZipsLayoutPath);
    linkNonAggregateLayoutContent(buildTasksPath, nestedZipsLayoutPath, /*metadataOnly*/false);

    // create the nested task zips (part of the tasks layout)
    console.log();
    console.log('> Creating nested task zips (content for tasks)');
    compressTasks(nestedZipsLayoutPath, tasksLayoutPath, /*individually:*/true);

    // link the task metadata into the tasks layout
    console.log();
    console.log('> Linking metadata content for tasks');
    linkNonAggregateLayoutContent(buildTasksPath, tasksLayoutPath, /*metadataOnly*/true);

    if (!omitLayoutVersion) {
        // mark the layout with a version number.
        // servicing supports both this new format and the legacy layout format as well.
        fs.writeFileSync(path.join(tasksLayoutPath, 'layout-version.txt'), '2');
    }
}
exports.createIndividualTaskZipFiles = createIndividualTaskZipFiles;

var createTasksZip = function () {
    // zip the tasks
    console.log();
    console.log('> Zipping the tasks')
    compressTasks(tasksLayoutPath, tasksZipPath);
}
exports.createTasksZip = createTasksZip;

var fileToJson = function (file) {
    var jsonFromFile = JSON.parse(fs.readFileSync(file).toString());
    return jsonFromFile;
}
exports.fileToJson = fileToJson;