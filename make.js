
require('shelljs/make');
var fs = require('fs');
var path = require('path');
var util = require('./make-util');
// white list of tasks to make it into the build
var taskList = require('./make-tasks.json');

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

        var shouldBuildNode = true;

        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            var taskDef = require(taskJsonPath);
            // TODO: call validate taskJson
            shouldBuildNode = taskDef.execution.hasOwnProperty('Node');
        }

        //--------------------------------
        // Common: build, copy, install 
        //--------------------------------
        var commonJsonPath = path.join(taskPath, 'common.json');
        if (test('-f', commonJsonPath)) {
            var common = require(commonJsonPath);

            common.forEach(function(mod) {
                var commonPath = path.join(taskPath, mod['module']);
                var modName = path.basename(commonPath);
                var modOutDir = path.join(commonOutputPath, modName);

                if (!test('-d', modOutDir)) {
                    if (mod.type === 'node' && mod.compile == true) {
                        buildNodeTask(commonPath, modOutDir);
                        copyTaskResources(commonPath, modOutDir);

                        // install the common module to the task dir
                        mkdir('-p', path.join(taskPath, 'node_modules'));
                        rm('-Rf', path.join(taskPath, 'node_modules', modName));
                        pushd(taskPath);
                        run('npm install ' + modOutDir);
                        popd();
                    }
                }
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
