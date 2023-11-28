// parse command line options
var argv = require('minimist')(process.argv.slice(2));

// modules
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var util = require('./make-util');

// util functions
var test = util.test;
var fail = util.fail;
var addPath = util.addPath;
var matchFind = util.matchFind;
var fileToJson = util.fileToJson;

// global paths
var tasksPath = path.join(__dirname, 'Tasks');
var binPath = path.join(__dirname, 'node_modules', '.bin');
var makeOptionsPath = path.join(__dirname, 'make-options.json');
var genTaskPath = path.join(__dirname, '_generated');

// node min version
var minNodeVer = '6.10.3';

if (semver.lt(process.versions.node, minNodeVer)) {
    fail('requires node >= ' + minNodeVer + '.  installed: ' + process.versions.node);
}

// add node modules .bin to the path so we can dictate version of tsc etc...
if (!test('-d', binPath)) {
    fail('node modules bin not found. ensure npm install has been run.');
}

addPath(binPath);

// resolve list of tasks
var taskList;

if (argv.task) {
    var findConfig = {
        noRecurse: true,
        matchBase: true
    };

    // find using --task parameter
    taskList = matchFind(argv.task, tasksPath, findConfig).map(x => path.basename(x));

    // If base tasks was not found, try to find the task in the _generated tasks folder
    if (taskList.length == 0 && fs.existsSync(genTaskPath)) {
        taskList = matchFind(argv.task, genTaskPath, findConfig).map(x => path.basename(x));
    }

    if (!taskList.length) {
        fail('Unable to find any tasks matching pattern ' + argv.task);
    }
} else {
    // load the default list
    taskList = fileToJson(makeOptionsPath).tasks;
}

// set the runner options. should either be empty or a comma delimited list of test runners.
// for example: ts OR ts,ps
//
// note, currently the ts runner igores this setting and will always run.
process.env['TASK_TEST_RUNNER'] = argv.runner || '';

var command = argv._[0];

var CLI = {};

fs.readdirSync(path.join(__dirname, 'cli')).forEach(function (file) {
    if (path.extname(file) === '.js') {
        var name = path.basename(file, '.js');
        CLI[name] = require('./cli/' + file);
    }
});

if (typeof CLI[command] !== 'function') {
  fail('Invalid CLI command: "' + command + '"\r\nValid commands:' + Object.keys(CLI));
}

CLI[command]({
    ...argv,
    taskList
});
