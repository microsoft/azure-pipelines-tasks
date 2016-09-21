// parse command line options
var minimist = require('minimist');
var mopts = {
    string: [
        'suite',
        'task'
    ],
    default: {
        suite: '',
        task: ''
    }
};
var options = minimist(process.argv, mopts);

// remove well-known parameters from argv before loading make,
// otherwise each arg will be interpreted as a make target
process.argv = options._;

require('shelljs/make');
var fs = require('fs');
var path = require('path');
var util = require('./make-util');

// default lists of tasks to build
var makeOptions = require('./make-options.json');
var taskList = makeOptions['tasks'];

// util functions
var run = util.run;
var banner = util.banner;
var rp = util.rp;
var fail = util.fail;
var ensureExists = util.ensureExists;
var pathExists = util.pathExists;
var buildNodeTask = util.buildNodeTask;
var addPath = util.addPath;
var copyTaskResources = util.copyTaskResources;
var ensureTool = util.ensureTool;
var assert = util.assert;
var getExternals = util.getExternals;
var createResjson = util.createResjson;
var createTaskLocJson = util.createTaskLocJson;
var validateTask = util.validateTask;

var buildPath = path.join(__dirname, '_build');
var commonOutputPath = path.join(buildPath, 'Common');
var testPath = path.join(__dirname, '_test');

// add node modules .bin to the path so we can dictate version of tsc etc...
var binPath = path.join(__dirname, 'node_modules', '.bin');
if (!test('-d', binPath)) {
    fail('node modules bin not found.  ensure npm install has been run.');
}
addPath(binPath);

target.clean = function () {
    rm('-Rf', commonOutputPath);
    rm('-Rf', buildPath);
    mkdir('-p', buildPath);
    rm('-Rf', testPath);
};

// ex: node make.js build -- ShellScript
target.build = function() {
    target.clean();

    ensureTool('tsc', '--version');

    // filter tasks
    var tasksToBuild = options.task ? [ options.task ] : taskList;
    
    tasksToBuild.forEach(function(taskName) {
        banner('Building: ' + taskName);
        var taskPath = path.join(__dirname, 'Tasks', taskName);
        ensureExists(taskPath);

        var outDir = path.join(buildPath, path.basename(taskPath));
        mkdir('-p', outDir);

        // load the task.json
        var shouldBuildNode = false;
        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            var taskDef = require(taskJsonPath);
            validateTask(taskDef);

            // create loc files
            createTaskLocJson(taskPath);
            createResjson(taskDef, taskPath);

            // determine whether node task
            shouldBuildNode = taskDef.execution.hasOwnProperty('Node');
        }

        // get externals
        var taskMakePath = path.join(taskPath, 'make.json');
        var taskMake = test('-f', taskMakePath) ? require(taskMakePath) : {};
        if (taskMake.hasOwnProperty('externals')) {
            console.log('Getting task externals');
            getExternals(taskMake.externals, outDir);
        }

        //--------------------------------
        // Common: build, copy, install 
        //--------------------------------
        if (taskMake.hasOwnProperty('common')) {
            var common = taskMake['common'];

            common.forEach(function(mod) {
                var modPath = path.join(taskPath, mod['module']);
                var modName = path.basename(modPath);
                var modOutDir = path.join(commonOutputPath, modName);

                if (!test('-d', modOutDir)) {
                    banner('Building module ' + modPath, true);

                    mkdir('-p', modOutDir);

                    // create loc files
                    var modJsonPath = path.join(modPath, 'module.json');
                    if (test('-f', modJsonPath)) {
                        createResjson(require(modJsonPath), modPath);
                    }

                    // build the common node module
                    if (mod.type === 'node' && mod.compile == true) {
                        buildNodeTask(modPath, modOutDir);
                    }

                    // copy default resources and any additional resources defined in the module's make.json
                    var modMakePath = path.join(modPath, 'make.json');
                    var modMake = test('-f', modMakePath) ? require(modMakePath) : {};
                    copyTaskResources(modMake, modPath, modOutDir);

                    // get externals
                    if (modMake.hasOwnProperty('externals')) {
                        console.log('Getting module externals');
                        getExternals(modMake.externals, modOutDir);
                    }
                }

                // npm install the common module to the task dir
                if (mod.type === 'node' && mod.compile == true) {
                    mkdir('-p', path.join(taskPath, 'node_modules'));
                    rm('-Rf', path.join(taskPath, 'node_modules', modName));
                    var originalDir = pwd();
                    cd(taskPath);
                    run('npm install ' + modOutDir);
                    cd(originalDir);
                }
                // copy module resources to the task output dir
                else if (mod.type === 'ps') {
                    var dest = path.join(outDir, 'ps_modules', modName);
                    mkdir('-p', dest);
                    fs.readdirSync(modOutDir)
                        .filter(function (file) {
                            return file != 'Tests';
                        })
                        .forEach(function (file) {
                            var source = path.join(modOutDir, file);
                            cp('-R', source, dest);
                        });
                }
            });
        }

        // ------------------
        // Build Node Task
        // ------------------
        if (shouldBuildNode) {
            buildNodeTask(taskPath, outDir);
        }

        // copy default resources and any additional resources defined in the task's make.json
        copyTaskResources(taskMake, taskPath, outDir);
    });

    banner('Build successful', true);
}

// will run tests for the scope of tasks being built
// ex: node make.js test
// or ex: npm test
target.test = function() {
    ensureTool('mocha', '--version');

    var suiteType = options.suite || 'L0';
    var taskType = options.task || '**';
    var testsSpec = path.join(buildPath, taskType, 'Tests', suiteType + ".js");
    run('mocha ' + testsSpec, true);

    // TODO: add legacy test approach for migration purposes
}
