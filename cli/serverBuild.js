/* eslint-disable no-prototype-builtins */
var fs = require('fs');
var path = require('path');
var semver = require('semver');

var clean = require('./clean.js');
var util = require('../make-util');

var fileToJson = util.fileToJson;
var ensureTool = util.ensureTool;
var fail = util.fail;
var rm = util.rm;
var banner = util.banner;
var test = util.test;
var validateTask = util.validateTask;
var ensureExists = util.ensureExists;
var createTaskLocJson = util.createTaskLocJson;
var cd = util.cd;
var cp = util.cp;
var mkdir = util.mkdir;
var run = util.run;
var buildNodeTask = util.buildNodeTask;
var copyTaskResources = util.copyTaskResources;
var matchCopy = util.matchCopy;
var getExternals = util.getExternals;
var createResjson = util.createResjson;

var buildTasksPath = path.join(__dirname, '_build', 'Tasks');
var makeOptionsPath = path.join(__dirname, 'make-options.json');
var baseConfigToolPath = path.join(__dirname, 'BuildConfigGen');
var genTaskPath = path.join(__dirname, '_generated');
var tasksPath = path.join(__dirname, 'Tasks');
var genTaskCommonPath = path.join(__dirname, '_generated', 'Common');
var buildTasksCommonPath = path.join(__dirname, '_build', 'Tasks', 'Common');

var supportedNodeTargets = ["Node", "Node10"/*, "Node14"*/];

// Node 14 is supported by the build system, but not currently by the agent. Block it for now
var node10Version = '10.24.1';
var node20Version = '20.3.1';

function buildTask(taskName, taskListLength, nodeVersion) {
    let isGeneratedTask = false;
    banner(`Building task ${taskName} using Node.js ${nodeVersion}`);
    const removeNodeModules = taskListLength > 1;

    // If we have the task in generated folder, prefer to build from there and add all generated tasks which starts with task name
    var taskPath = path.join(genTaskPath, taskName);
    if (fs.existsSync(taskPath)) {
        // Need to add all tasks which starts with task name
        console.log('Found generated task: ' + taskName);
        isGeneratedTask = true;
    } else {
        taskPath = path.join(tasksPath, taskName);
    }

    ensureExists(taskPath);

    // load the task.json
    var outDir;
    var shouldBuildNode = test('-f', path.join(taskPath, 'tsconfig.json'));
    var taskJsonPath = path.join(taskPath, 'task.json');
    if (test('-f', taskJsonPath)) {
        var taskDef = fileToJson(taskJsonPath);
        validateTask(taskDef);

        // fixup the outDir (required for relative pathing in legacy L0 tests)
        outDir = path.join(buildTasksPath, taskName);

        if(fs.existsSync(outDir))
        {
            console.log('Remove existing outDir: ' + outDir);
            rm('-rf', outDir);
        }

        // create loc files
        createTaskLocJson(taskPath);
        createResjson(taskDef, taskPath);

        // determine the type of task
        shouldBuildNode = shouldBuildNode || supportedNodeTargets.some(node => taskDef.execution.hasOwnProperty(node));
    } else {
        outDir = path.join(buildTasksPath, path.basename(taskPath));
    }

    mkdir('-p', outDir);

    // get externals
    var taskMakePath = path.join(taskPath, 'make.json');
    var taskMake = test('-f', taskMakePath) ? fileToJson(taskMakePath) : {};
    if (taskMake.hasOwnProperty('externals')) {
        console.log('');
        console.log('> getting task externals');
        getExternals(taskMake.externals, outDir);
    }

    //--------------------------------
    // Common: build, copy, install
    //--------------------------------
    var commonPacks = [];
    if (taskMake.hasOwnProperty('common')) {
        var common = taskMake['common'];

        common.forEach(function(mod) {
            var modPath = path.join(taskPath, mod['module']);
            var modName = path.basename(modPath);
            var modOutDir = path.join(buildTasksCommonPath, modName);

            if (!test('-d', modOutDir)) {
                banner('Building module ' + modPath, true);

                // Ensure that Common folder exists for _generated tasks, otherwise copy it from Tasks folder
                if (!fs.existsSync(genTaskCommonPath) && isGeneratedTask) {
                    cp('-Rf', path.resolve(tasksPath, "Common"), genTaskCommonPath);
                }

                mkdir('-p', modOutDir);

                // create loc files
                var modJsonPath = path.join(modPath, 'module.json');
                if (test('-f', modJsonPath)) {
                    createResjson(fileToJson(modJsonPath), modPath);
                }

                // npm install and compile
                if ((mod.type === 'node' && mod.compile == true) || test('-f', path.join(modPath, 'tsconfig.json'))) {
                    buildNodeTask(modPath, modOutDir);
                }

                // copy default resources and any additional resources defined in the module's make.json
                console.log();
                console.log('> copying module resources');
                var modMakePath = path.join(modPath, 'make.json');
                var modMake = test('-f', modMakePath) ? fileToJson(modMakePath) : {};
                copyTaskResources(modMake, modPath, modOutDir);

                // get externals
                if (modMake.hasOwnProperty('externals')) {
                    console.log('');
                    console.log('> getting module externals');
                    getExternals(modMake.externals, modOutDir);
                }

                if (mod.type === 'node' && mod.compile == true || test('-f', path.join(modPath, 'package.json'))) {
                    var commonPack = util.getCommonPackInfo(modOutDir);

                    // assert the pack file does not already exist (name should be unique)
                    if (test('-f', commonPack.packFilePath)) {
                        fail(`Pack file already exists: ${commonPack.packFilePath}`);
                    }

                    // pack the Node module. a pack file is required for dedupe.
                    // installing from a folder creates a symlink, and does not dedupe.
                    cd(path.dirname(modOutDir));
                    run(`npm pack ./${path.basename(modOutDir)}`);
                }
            }

            // store the npm pack file info
            if (mod.type === 'node' && mod.compile == true) {
                commonPacks.push(util.getCommonPackInfo(modOutDir));
            // copy ps module resources to the task output dir
            } else if (mod.type === 'ps') {
                console.log();
                console.log('> copying ps module to task');
                var dest;
                if (mod.hasOwnProperty('dest')) {
                    dest = path.join(outDir, mod.dest, modName);
                } else {
                    dest = path.join(outDir, 'ps_modules', modName);
                }

                matchCopy('!Tests', modOutDir, dest, { noRecurse: true, matchBase: true });
            }
        });

        // npm install the common modules to the task dir
        if (commonPacks.length) {
            cd(taskPath);
            var installPaths = commonPacks.map(function (commonPack) {
                return `file:${path.relative(taskPath, commonPack.packFilePath)}`;
            });
            run(`npm install --save-exact ${installPaths.join(' ')}`);
        }
    }

    // build Node task
    if (shouldBuildNode) {
        buildNodeTask(taskPath, outDir);
    }

    // remove the hashes for the common packages, they change every build
    if (commonPacks.length) {
        var lockFilePath = path.join(taskPath, 'package-lock.json');
        if (!test('-f', lockFilePath)) {
            lockFilePath = path.join(taskPath, 'npm-shrinkwrap.json');
        }
        var packageLock = fileToJson(lockFilePath);
        Object.keys(packageLock.dependencies).forEach(function (dependencyName) {
            commonPacks.forEach(function (commonPack) {
                if (dependencyName == commonPack.packageName) {
                    delete packageLock.dependencies[dependencyName].integrity;
                }
            });
        });
        fs.writeFileSync(lockFilePath, JSON.stringify(packageLock, null, '  '));
    }

    // copy default resources and any additional resources defined in the task's make.json
    console.log();
    console.log('> copying task resources');
    copyTaskResources(taskMake, taskPath, outDir);

    if (removeNodeModules) {
        const taskNodeModulesPath = path.join(taskPath, 'node_modules');

        if (fs.existsSync(taskNodeModulesPath)) {
            console.log('\n> removing node modules');
            rm('-Rf', taskNodeModulesPath);
        }

        const taskTestsNodeModulesPath = path.join(taskPath, 'Tests', 'node_modules');

        if (fs.existsSync(taskTestsNodeModulesPath)) {
            console.log('\n> removing task tests node modules');
            rm('-Rf', taskTestsNodeModulesPath);
        }
    }

    // remove duplicated task libs node modules from build tasks.
    var buildTasksNodeModules = path.join(buildTasksPath, taskName, 'node_modules');
    var duplicateTaskLibPaths = [
        'azure-pipelines-tasks-java-common', 'azure-pipelines-tasks-codecoverage-tools', 'azure-pipelines-tasks-codeanalysis-common',
        'azure-pipelines-tool-lib', 'azure-pipelines-tasks-utility-common', 'azure-pipelines-tasks-packaging-common', 'artifact-engine',
        'azure-pipelines-tasks-azure-arm-rest'
    ];
    for (var duplicateTaskPath of duplicateTaskLibPaths) {
        const buildTasksDuplicateNodeModules = path.join(buildTasksNodeModules, duplicateTaskPath, 'node_modules', 'azure-pipelines-task-lib');
        if (fs.existsSync(buildTasksDuplicateNodeModules)) {
            console.log(`\n> removing duplicated task-lib node modules in ${buildTasksDuplicateNodeModules}`);
            rm('-Rf', buildTasksDuplicateNodeModules);
        }
    }
}

function getTaskList(taskList) {
    let tasksToBuild = taskList;

    if (!fs.existsSync(genTaskPath)) return tasksToBuild;

    const generatedTaskFolders = fs.readdirSync(genTaskPath)
        .filter((taskName) => {
            return fs.statSync(path.join(genTaskPath, taskName)).isDirectory();
        });

    taskList.forEach((taskName) => {
        generatedTaskFolders.forEach((generatedTaskName) => {
            if (taskName !== generatedTaskName && generatedTaskName.startsWith(taskName)) {
                tasksToBuild.push(generatedTaskName);
            }
        });
    });

    return tasksToBuild.sort();
}

function getNodeVersion (taskName) {
    var packageJsonPath = path.join(genTaskPath, taskName, "package.json");
    // We prefer tasks in _generated folder because they might contain node20 version
    // while the tasks in Tasks/ folder still could use only node16 handler 
    if (fs.existsSync(packageJsonPath)) {
        console.log(`Found package.json for ${taskName} in _generated folder ${packageJsonPath}`);
    } else {
        packageJsonPath = path.join(tasksPath, taskName, "package.json");
        if (!fs.existsSync(packageJsonPath)) {
            console.error(`Unable to find package.json file for ${taskName} in _generated folder or Tasks folder, using default node 10.`);
            return 10;
        }
        console.log(`Found package.json for ${taskName} in Tasks folder ${packageJsonPath}`)
    }

    var packageJsonContents = fs.readFileSync(packageJsonPath, { encoding: 'utf-8' });
    var packageJson = JSON.parse(packageJsonContents);
    if (packageJson.dependencies && packageJson.dependencies["@types/node"]) {
        // Extracting major version from the node version
        const nodeVersion = packageJson.dependencies["@types/node"].replace('^', '');
        console.log(`Node verion from @types/node in package.json is ${nodeVersion} returning ${nodeVersion.split('.')[0]}`);
        return nodeVersion.split('.')[0];
    } else {
        console.log("Node version not found in dependencies, using default node 10.");
        return 10;
    }
}

function serverBuild(/** @type {{ task: string }} */ argv) {
    clean.ensureBuildTasksAndRemoveTestPath();
    ensureTool('tsc', '--version', 'Version 4.0.2');
    ensureTool('npm', '--version', function (output) {
        if (semver.lt(output, '5.6.0')) {
            fail('Expected 5.6.0 or higher. To fix, run: npm install -g npm');
        }
    });

    // Need to validate generated tasks first
    const makeOptions = fileToJson(makeOptionsPath);

    util.processGeneratedTasks(baseConfigToolPath, argv.taskList, makeOptions, argv.writeUpdatedsFromGenTasks);

    const allTasks = getTaskList(argv.taskList);

    // Wrap build function  to store files that changes after the build 
    const buildTaskWrapped = util.syncGeneratedFilesWrapper(buildTask, genTaskPath, argv.writeUpdatedsFromGenTasks);
    const allTasksNode20 = allTasks.filter((taskName) => {
        return getNodeVersion(taskName) == 20;
    });
    const allTasksDefault = allTasks.filter((taskName) => {
        return getNodeVersion(taskName) != 20;
    });

    if (allTasksNode20.length > 0) {
        util.installNode('20');
        ensureTool('node', '--version', `v${node20Version}`);
        allTasksNode20.forEach(taskName => buildTaskWrapped(taskName, allTasksNode20.length, 20));

    } 
    if (allTasksDefault.length > 0) {
        util.installNode('10');
        ensureTool('node', '--version', `v${node10Version}`);
        allTasksDefault.forEach(taskName => buildTaskWrapped(taskName, allTasksDefault.length, 10));
    }

    // Remove Commons from _generated folder as it is not required
    if (fs.existsSync(genTaskCommonPath)) {
        rm('-Rf', genTaskCommonPath);
    }

    banner('Build successful', true);
}

module.exports = {
    serverBuild,
    getTaskList
};