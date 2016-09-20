
require('shelljs/make');
var fs = require('fs');
var path = require('path');
var util = require('./make-util');
// white list of tasks to make it into the build

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

var commonOutputPath = path.join(__dirname, '_common');
var buildPath = path.join(__dirname, '_build');
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
    var taskName = process.argv[4];
    var tasksToBuild = taskName ? [ taskName ] : taskList;
    
    tasksToBuild.forEach(function(taskName) {
        banner('Building: ' + taskName);
        var taskPath = path.join(__dirname, 'Tasks', taskName);
        ensureExists(taskPath);

        var outDir = path.join(buildPath, path.basename(taskPath));
        mkdir('-p', outDir);

        var shouldBuildNode = false;

        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            // load the task.json
            var taskDef = require(taskJsonPath);
            validateTask(taskDef);

            // create loc files
            createTaskLocJson(taskPath);
            createResjson(taskDef, taskPath);

            // determine whether node task
            shouldBuildNode = taskDef.execution.hasOwnProperty('Node');
        }

        // common and externals options specific to our scripts
        var taskMakePath = path.join(taskPath, 'make.json');
        var taskMake = test('-f', taskMakePath) ? require(taskMakePath) : {};

        // get externals
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
                var commonPath = path.join(taskPath, mod['module']);
                var modName = path.basename(commonPath);
                var modOutDir = path.join(commonOutputPath, modName);

                if (!test('-d', modOutDir)) {
                    banner('Building module ' + commonPath, true);

                    mkdir('-p', modOutDir);

                    // create loc files
                    var modJsonPath = path.join(commonPath, 'module.json');
                    if (test('-f', modJsonPath)) {
                        createResjson(require(modJsonPath), commonPath);
                    }

                    // build the common node module
                    if (mod.type === 'node' && mod.compile == true) {
                        buildNodeTask(commonPath, modOutDir);
                    }

                    // todo: copy additional resources based on the local make.json
                    copyTaskResources(commonPath, modOutDir);

                    // get externals
                    var modMakePath = path.join(commonPath, 'make.json');
                    var modMake = test('-f', modMakePath) ? require(modMakePath) : {};
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

                // todo: copy common module resources to the task dir
            });
        }

        // ------------------
        // Build Node Task
        // ------------------
        if (shouldBuildNode) {
            buildNodeTask(taskPath, outDir);
        }

        copyTaskResources(taskPath, outDir);
    });

    banner('Build successful', true);
}

// will run tests for the scope of tasks being built
// ex: node make.js test
// or ex: npm test
target.test = function() {
    ensureTool('mocha', '--version');

    var suiteArg = process.argv[4];
    var suiteType = suiteArg || 'L0';  
    var testsSpec = path.join(buildPath, "/**/Tests", suiteType + ".js");
    run("mocha " + testsSpec, true);

    // TODO: add legacy test approach for migration purposes
}
