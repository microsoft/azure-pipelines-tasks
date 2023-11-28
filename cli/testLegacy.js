/* eslint-disable no-prototype-builtins */
var os = require('os');
var fs = require('fs');
var path = require('path');

var util = require('../make-util');

var ensureTool = util.ensureTool;
var rm = util.rm;
var mkdir = util.mkdir;
var cd = util.cd;
var run = util.run;
var matchCopy = util.matchCopy;
var banner = util.banner;
var matchFind = util.matchFind;
var fail = util.fail;
var test = util.test;
var fileToJson = util.fileToJson;

var buildTasksPath = path.join(__dirname, '_build', 'Tasks');
var testsLegacyPath = path.join(__dirname, 'Tests-Legacy');
var legacyTestTasksPath = path.join(__dirname, '_test', 'Tasks');
var buildTasksCommonPath = path.join(__dirname, '_build', 'Tasks', 'Common');
var testTestsLegacyPath = path.join(__dirname, '_test', 'Tests-Legacy');
var testPath = path.join(__dirname, '_test');
var tasksPath = path.join(__dirname, 'Tasks');

//
// node make.js testLegacy
// node make.js testLegacy --suite L0/XCode
//
function testLegacy(/** @type {{ suite: string; node: string; task: string }} */ argv) {
    ensureTool('tsc', '--version', 'Version 4.0.2');
    ensureTool('mocha', '--version', '6.2.3');

    if (argv.suite) {
        fail('The "suite" parameter has been deprecated. Use the "task" parameter instead.');
    }

    // clean
    console.log('removing _test');
    rm('-Rf', testPath);

    // copy the L0 source files for each task; copy the layout for each task
    console.log();
    console.log('> copying tasks');
    argv.taskList.forEach(function (taskName) {
        var testCopySource = path.join(testsLegacyPath, 'L0', taskName);
        // copy the L0 source files if exist
        if (test('-e', testCopySource)) {
            console.log('copying ' + taskName);
            var testCopyDest = path.join(testTestsLegacyPath, 'L0', taskName);
            matchCopy('*', testCopySource, testCopyDest, { noRecurse: true, matchBase: true });

            // copy the task layout
            var taskCopySource = path.join(buildTasksPath, taskName);
            var taskCopyDest = path.join(legacyTestTasksPath, taskName);
            matchCopy('*', taskCopySource, taskCopyDest, { noRecurse: true, matchBase: true });
        }

        // copy each common-module L0 source files if exist
        var taskMakePath = path.join(tasksPath, taskName, 'make.json');
        var taskMake = test('-f', taskMakePath) ? fileToJson(taskMakePath) : {};
        if (taskMake.hasOwnProperty('common')) {
            var common = taskMake['common'];
            common.forEach(function(mod) {
                // copy the common-module L0 source files if exist and not already copied
                var modName = path.basename(mod['module']);
                console.log('copying ' + modName);
                var modTestCopySource = path.join(testsLegacyPath, 'L0', `Common-${modName}`);
                var modTestCopyDest = path.join(testTestsLegacyPath, 'L0', `Common-${modName}`);
                if (test('-e', modTestCopySource) && !test('-e', modTestCopyDest)) {
                    matchCopy('*', modTestCopySource, modTestCopyDest, { noRecurse: true, matchBase: true });
                }
                var modCopySource = path.join(buildTasksCommonPath, modName);
                var modCopyDest = path.join(legacyTestTasksPath, 'Common', modName);
                if (test('-e', modCopySource) && !test('-e', modCopyDest)) {
                    // copy the common module layout
                    matchCopy('*', modCopySource, modCopyDest, { noRecurse: true, matchBase: true });
                }
            });
        }
    });

    // short-circuit if no tests
    if (!test('-e', testTestsLegacyPath)) {
        banner('no legacy tests found', true);
        return;
    }

    // copy the legacy test infra
    console.log();
    console.log('> copying legacy test infra');
    matchCopy('@(definitions|lib|tsconfig.json)', testsLegacyPath, testTestsLegacyPath, { noRecurse: true, matchBase: true });

    // copy the lib tests when running all legacy tests
    if (!argv.task) {
        matchCopy('*', path.join(testsLegacyPath, 'L0', 'lib'), path.join(testTestsLegacyPath, 'L0', 'lib'), { noRecurse: true, matchBase: true });
    }

    // compile legacy L0 and lib
    cd(testTestsLegacyPath);
    run('tsc --rootDir ' + testTestsLegacyPath);

    // create a test temp dir - used by the task runner to copy each task to an isolated dir
    var tempDir = path.join(testTestsLegacyPath, 'Temp');
    process.env['TASK_TEST_TEMP'] = tempDir;
    mkdir('-p', tempDir);

    // suite paths
    var testsSpec = matchFind(path.join('**', '_suite.js'), path.join(testTestsLegacyPath, 'L0'));
    if (!testsSpec.length) {
        fail(`Unable to find tests using the pattern: ${path.join('**', '_suite.js')}`);
    }

    // setup the version of node to run the tests
    util.installNode(argv.node);

    // mocha doesn't always return a non-zero exit code on test failure. when only
    // a single suite fails during a run that contains multiple suites, mocha does
    // not appear to always return non-zero. as a workaround, the following code
    // creates a wrapper suite with an "after" hook. in the after hook, the state
    // of the runnable context is analyzed to determine whether any tests failed.
    // if any tests failed, log a ##vso command to fail the build.
    var testsSpecPath = testsSpecPath = path.join(testTestsLegacyPath, 'testsSpec.js');
    var contents = 'var __suite_to_run;' + os.EOL;
    contents += 'describe(\'Legacy L0\', function (__outer_done) {' + os.EOL;
    contents += '    after(function (done) {' + os.EOL;
    contents += '        var failedCount = 0;' + os.EOL;
    contents += '        var suites = [ this._runnable.parent ];' + os.EOL;
    contents += '        while (suites.length) {' + os.EOL;
    contents += '            var s = suites.pop();' + os.EOL;
    contents += '            suites = suites.concat(s.suites); // push nested suites' + os.EOL;
    contents += '            failedCount += s.tests.filter(function (test) { return test.state != "passed" }).length;' + os.EOL;
    contents += '        }' + os.EOL;
    contents += '' + os.EOL;
    contents += '        if (failedCount && process.env.TF_BUILD) {' + os.EOL;
    contents += '            console.log("##vso[task.logissue type=error]" + failedCount + " test(s) failed");' + os.EOL;
    contents += '            console.log("##vso[task.complete result=Failed]" + failedCount + " test(s) failed");' + os.EOL;
    contents += '        }' + os.EOL;
    contents += '' + os.EOL;
    contents += '        done();' + os.EOL;
    contents += '    });' + os.EOL;
    testsSpec.forEach(function (itemPath) {
        contents += `    __suite_to_run = require(${JSON.stringify(itemPath)});` + os.EOL;
    });
    contents += '});' + os.EOL;
    fs.writeFileSync(testsSpecPath, contents);
    run('mocha ' + testsSpecPath, /*inheritStreams:*/true);
}

module.exports = testLegacy;