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

var consts = require('./consts');

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
    rm('-Rf', consts.buildTestsPath);
    mkdir('-p', path.join(consts.buildTestsPath));
    cd(consts.testsPath);
    run(`tsc --rootDir ${consts.testsPath} --outDir ${consts.buildTestsPath}`);
    console.log();
    console.log('> copying ps test lib resources');
    mkdir('-p', path.join(consts.buildTestsPath, 'lib'));
    matchCopy(path.join('**', '@(*.ps1|*.psm1)'), path.join(consts.testsPath, 'lib'), path.join(consts.buildTestsPath, 'lib'));

    var suiteType = argv.suite || 'L0';
    function runTaskTests(taskName) {
        banner('Testing: ' + taskName);
        // find the tests
        var nodeVersions = argv.node ? new Array(argv.node) : [Math.max(...getTaskNodeVersion(consts.buildTasksPath, taskName))];
        var pattern1 = path.join(consts.buildTasksPath, taskName, 'Tests', suiteType + '.js');
        var pattern2 = path.join(consts.buildTasksPath, 'Common', taskName, 'Tests', suiteType + '.js');
        var taskPath = path.join('**', '_build', 'Tasks', taskName, "**", "*.js").replace(/\\/g, '/');
        var isNodeTask = util.isNodeTask(consts.buildTasksPath, taskName);

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
                    run('nyc --all -n ' + taskPath + ' --report-dir ' + consts.coverageTasksPath + ' mocha ' + testsSpec.join(' '), /*inheritStreams:*/true);
                    util.renameCodeCoverageOutput(consts.coverageTasksPath, taskName);
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
        var taskPath = path.join(consts.buildTasksPath, taskName);
        if (fs.existsSync(taskPath)) {
            runTaskTests(taskName);
        }
    });

    var specs;

    if (!argv.task) {
        banner('Running common library tests');
        var commonLibPattern = path.join(consts.buildTasksPath, 'Common', '*', 'Tests', suiteType + '.js');
        specs = [];
        if (matchFind(commonLibPattern, consts.buildTasksPath).length > 0) {
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
    var commonPattern = path.join(consts.buildTestsPath, suiteType + '.js');
    specs = matchFind(commonPattern, consts.buildTestsPath, { noRecurse: true });
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
        util.rm(path.join(consts.coverageTasksPath, '*coverage-summary.json'));
        util.run(`nyc merge ${consts.coverageTasksPath} ${path.join(consts.coverageTasksPath, 'mergedcoverage.json')}`, true);
        util.rm(path.join(consts.coverageTasksPath, '*-coverage.json'));
        util.run(`nyc report -t ${consts.coverageTasksPath} --report-dir ${consts.coverageTasksPath} --reporter=cobertura`, true);
        util.rm(path.join(consts.coverageTasksPath, 'mergedcoverage.json'));
    } catch (e) {
        console.log('Error while generating coverage report')
    }
}

module.exports = test;