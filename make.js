
require('shelljs/make');
var fs = require('fs');
var path = require('path');
var util = require('./make-util');
// white list of tasks to make it into the build
var taskList = require('./make-tasks.json');
var run = util.run;

var banner = function (message, noBracket) {
    console.log();
    if (!noBracket) {
        console.log('------------------------------------------------------------');
    }
    console.log(message);
    if (!noBracket) {
        console.log('------------------------------------------------------------');
    }
    console.log();
}

var rp = function (relPath) {
    return path.join(pwd() + '', relPath);
}

var tp = function(relPath) {
    return path.join()
}

var fail = function (message) {
    console.error('ERROR: ' + message);
    process.exit(1);
}

var ensureExists = function (checkPath) {
    var exists = test('-d', checkPath) || test('-f', checkPath);

    if (!exists) {
        fail(checkPath + ' does not exist');
    }    
}

var buildPath = path.join(__dirname, '_build');
var testPath = path.join(__dirname, '_test');

target.clean = function () {
    rm('-Rf', buildPath);
    mkdir('-p', buildPath);
    rm('-Rf', testPath);
};

// ex: node make.js build -- ShellScript
target.build = function() {
    target.clean();
    
    var taskName = process.argv[4];
    var tasksToBuild = taskName ? [ taskName ] : taskList;

    tasksToBuild.forEach(function(taskName) {
        banner('Building: ' + taskName);
        var taskPath = path.join(__dirname, 'Tasks', taskName);
        ensureExists(taskPath);

        pushd(taskPath);
        var buildNodeTask = true;

        // extract what you need out of task.json here.
        // common does not have a task.json
        if (test('-f', rp('task.json'))) {
            var taskDef = require(rp('task.json'));
            // TODO: call validate taskJson
            buildNodeTask = taskDef.execution.hasOwnProperty('Node');
        }

        // ------------------
        // Build Node Task
        // ------------------
        if (buildNodeTask) {
            if (test('-f', rp('package.json'))) {
                console.log('installing node modules');
                run('npm install', true);
            }
            run('tsc', true);
        }
 
        cp('-R', taskPath, buildPath);
        popd();
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
