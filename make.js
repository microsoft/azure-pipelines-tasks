
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
var buildNodeTask = util.buildNodeTask;
var addPath = util.addPath;
var buildPath = path.join(__dirname, '_build');
var testPath = path.join(__dirname, '_test');

// add node modules .bin to the path so we can dictate version of tsc etc...
var binPath = path.join(__dirname, 'node_modules', '.bin');
if (!test('-d', binPath)) {
    fail('node modules bin not found.  ensure npm install has been run.');
}
addPath(binPath);

target.clean = function () {
    rm('-Rf', buildPath);
    mkdir('-p', buildPath);
    rm('-Rf', testPath);
};

// ex: node make.js build -- ShellScript
target.build = function() {
    target.clean();

    // ensure tsc
    var tscPath = which('tsc');
    if (!tscPath) {
        fail('tsc not found.  run npm install');
    }

    var tscVersion = exec('tsc --version');
    console.log(tscPath + '');

    // filter tasks
    var taskName = process.argv[4];
    var tasksToBuild = taskName ? [ taskName ] : taskList;
    
    // ensure we only compile common modules once
    var commonBuilt = {};

    tasksToBuild.forEach(function(taskName) {
        banner('Building: ' + taskName);
        var taskPath = path.join(__dirname, 'Tasks', taskName);
        ensureExists(taskPath);

        var shouldBuildNode = true;

        // extract what you need out of task.json here.
        // common does not have a task.json
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

                if (mod.type === 'node' && mod.compile == true) {
                    if (!commonBuilt[commonPath]) {
                        buildNodeTask(commonPath);
                    }
                    
                    commonBuilt[commonPath] = true;
                }
                
                if (mod.dest) {
                    var dest = path.join(taskPath, mod.dest);                    
                    console.log('copying ' + modName + ' to ' + dest);
                    cp('-R', commonPath, dest);

                    // remove any typings in module built and copied to avoid conflicts
                    //rm('-Rf', path.join(dest, modName, 'typings'));
                }
            });
        }

        // ------------------
        // Build Node Task
        // ------------------
        if (shouldBuildNode) {
            buildNodeTask(taskPath);
        }
 
        cp('-R', taskPath, buildPath);
    });

    banner('Build successful', true);
}

// will run tests for the scope of tasks being built
// ex: node make.js test
// or ex: npm test
target.test = function() {
    // TODO: validate mocha installed and min version
    var suiteArg = process.argv[4];
    var suiteType = suiteArg || 'L0';  
    var testsSpec = path.join(__dirname, "/**/Tests", suiteType + ".js");
    run("mocha " + testsSpec);

    // TODO: add legacy test approach for migration purposes
}
