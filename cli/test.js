var fs = require('fs');
var path = require('path');

var util = require('../make-util');
var serverBuild = require('./serverBuild');

var ensureTool = util.ensureTool;
var rm = util.rm;
var mkdir = util.mkdir;
var cd = util.cd;
var run = util.run;
var matchCopy = util.matchCopy;
var banner = util.banner;
var getTaskNodeVersion = util.getTaskNodeVersion;
var matchFind = util.matchFind;

var buildPath = path.join(__dirname, '_build');
var buildTestsPath = path.join(__dirname, '_build', 'Tests');
var testsPath = path.join(__dirname, 'Tests');
var buildTasksPath = path.join(__dirname, '_build', 'Tasks');
var coverageTasksPath = path.join(buildPath, 'coverage');

//
// will run tests for the scope of tasks being built
// npm test
// node make.js test
// node make.js test --task ShellScript --suite L0
//
function test(/** @type {{ suite: string; node: string; task: string }} */ argv) {
    var minIstanbulVersion = '10';
    ensureTool('tsc', '--version', 'Version 4.0.2');
    ensureTool('mocha', '--version', '6.2.3');

    // build the general tests and ps test infra
    rm('-Rf', buildTestsPath);
    mkdir('-p', path.join(buildTestsPath));
    cd(testsPath);
    run(`tsc --rootDir ${testsPath} --outDir ${buildTestsPath}`);
    console.log();
    console.log('> copying ps test lib resources');
    mkdir('-p', path.join(buildTestsPath, 'lib'));
    matchCopy(path.join('**', '@(*.ps1|*.psm1)'), path.join(testsPath, 'lib'), path.join(buildTestsPath, 'lib'));

    var suiteType = argv.suite || 'L0';
    function runTaskTests(taskName) {
        banner('Testing: ' + taskName);
        // find the tests
        var nodeVersions = argv.node ? new Array(argv.node) : [Math.max(...getTaskNodeVersion(buildTasksPath, taskName))];
        var pattern1 = path.join(buildTasksPath, taskName, 'Tests', suiteType + '.js');
        var pattern2 = path.join(buildTasksPath, 'Common', taskName, 'Tests', suiteType + '.js');
        var taskPath = path.join('**', '_build', 'Tasks', taskName, "**", "*.js").replace(/\\/g, '/');
        var isNodeTask = util.isNodeTask(buildTasksPath, taskName);

        var isReportWasFormed = false;
        var testsSpec = [];

        if (fs.existsSync(pattern1)) {
            testsSpec.push(pattern1);
        }
        if (fs.existsSync(pattern2)) {
            testsSpec.push(pattern2);
        }

        if (testsSpec.length == 0) {
            console.warn(`Unable to find tests using the following patterns: ${JSON.stringify([pattern1, pattern2])}`);
            return;
        }

        nodeVersions.forEach(function (nodeVersion) {
            try {
                nodeVersion = String(nodeVersion);
                banner('Run Mocha Suits for node ' + nodeVersion);
                // setup the version of node to run the tests
                util.installNode(nodeVersion);


                if (isNodeTask && !isReportWasFormed && nodeVersion >= 10) {
                    run('nyc --all -n ' + taskPath + ' --report-dir ' + coverageTasksPath + ' mocha ' + testsSpec.join(' '), /*inheritStreams:*/true);
                    util.renameCodeCoverageOutput(coverageTasksPath, taskName);
                    isReportWasFormed = true;
                }
                else {
                    run('mocha ' + testsSpec.join(' '), /*inheritStreams:*/true);
                }
            }  catch (e) {
                console.error(e);
                process.exit(1);
            }
        });
    }

    // Run tests for each task that exists
    const allTasks = serverBuild.getTaskList(argv.taskList);

    allTasks.forEach(function(taskName) {
        var taskPath = path.join(buildTasksPath, taskName);
        if (fs.existsSync(taskPath)) {
            runTaskTests(taskName);
        }
    });

    var specs;

    if (!argv.task) {
        banner('Running common library tests');
        var commonLibPattern = path.join(buildTasksPath, 'Common', '*', 'Tests', suiteType + '.js');
        specs = [];
        if (matchFind(commonLibPattern, buildTasksPath).length > 0) {
            specs.push(commonLibPattern);
        }
        if (specs.length > 0) {
            // setup the version of node to run the tests
            util.installNode(argv.node);
            run('mocha ' + specs.join(' '), /*inheritStreams:*/true);
        } else {
            console.warn("No common library tests found");
        }
    }

    // Run common tests
    banner('Running common tests');
    var commonPattern = path.join(buildTestsPath, suiteType + '.js');
    specs = matchFind(commonPattern, buildTestsPath, { noRecurse: true });
    if (specs.length > 0) {
        // setup the version of node to run the tests
        util.installNode(argv.node);
        run('mocha ' + specs.join(' '), /*inheritStreams:*/true);
    } else {
        console.warn("No common tests found");
    }

    try {
        // Installing node version 10 to run code coverage report, since common library tests run under node 6,
        // which is incompatible with nyc
        util.installNode(minIstanbulVersion);
        util.rm(path.join(coverageTasksPath, '*coverage-summary.json'));
        util.run(`nyc merge ${coverageTasksPath} ${path.join(coverageTasksPath, 'mergedcoverage.json')}`, true);
        util.rm(path.join(coverageTasksPath, '*-coverage.json'));
        util.run(`nyc report -t ${coverageTasksPath} --report-dir ${coverageTasksPath} --reporter=cobertura`, true);
        util.rm(path.join(coverageTasksPath, 'mergedcoverage.json'));
    } catch (e) {
        console.log('Error while generating coverage report')
    }
}

module.exports = test;