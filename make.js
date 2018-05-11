// parse command line options
var minimist = require('minimist');
var mopts = {
    string: [
        'node',
        'runner',
        'server',
        'suite',
        'task',
        'version'
    ]
};
var options = minimist(process.argv, mopts);

// remove well-known parameters from argv before loading make,
// otherwise each arg will be interpreted as a make target
process.argv = options._;

// modules
var make = require('shelljs/make');
var fs = require('fs');
var os = require('os');
var path = require('path');
var semver = require('semver');
var util = require('./make-util');

// util functions
var cd = util.cd;
var cp = util.cp;
var mkdir = util.mkdir;
var rm = util.rm;
var test = util.test;
var run = util.run;
var banner = util.banner;
var rp = util.rp;
var fail = util.fail;
var ensureExists = util.ensureExists;
var pathExists = util.pathExists;
var buildNodeTask = util.buildNodeTask;
var addPath = util.addPath;
var copyTaskResources = util.copyTaskResources;
var matchFind = util.matchFind;
var matchCopy = util.matchCopy;
var ensureTool = util.ensureTool;
var assert = util.assert;
var getExternals = util.getExternals;
var createResjson = util.createResjson;
var createTaskLocJson = util.createTaskLocJson;
var validateTask = util.validateTask;

// global paths
var buildPath = path.join(__dirname, '_build', 'Tasks');
var buildTestsPath = path.join(__dirname, '_build', 'Tests');
var commonPath = path.join(__dirname, '_build', 'Tasks', 'Common');
var packagePath = path.join(__dirname, '_package');
var legacyTestPath = path.join(__dirname, '_test', 'Tests-Legacy');
var legacyTestTasksPath = path.join(__dirname, '_test', 'Tasks');

// node min version
var minNodeVer = '6.10.3';
if (semver.lt(process.versions.node, minNodeVer)) {
    fail('requires node >= ' + minNodeVer + '.  installed: ' + process.versions.node);
}

// add node modules .bin to the path so we can dictate version of tsc etc...
var binPath = path.join(__dirname, 'node_modules', '.bin');
if (!test('-d', binPath)) {
    fail('node modules bin not found.  ensure npm install has been run.');
}
addPath(binPath);

// resolve list of tasks
var taskList;
if (options.task) {
    // find using --task parameter
    taskList = matchFind(options.task, path.join(__dirname, 'Tasks'), { noRecurse: true, matchBase: true })
        .map(function (item) {
            return path.basename(item);
        });
    if (!taskList.length) {
        fail('Unable to find any tasks matching pattern ' + options.task);
    }
}
else {
    // load the default list
    taskList = JSON.parse(fs.readFileSync(path.join(__dirname, 'make-options.json'))).tasks;
}

// For now filter further to just what's changed here.
// We could also use a --changed flag and preserve the force building of all.
// Not sure if there will be a use case for that after this change goes in
// But it would make things more explicit
// TODO: Maybe put the logic to get task lists into make util.
// TODO: Maybe put this in separate js file like set-task-slice.js(build-changed-js) and run it conditionally on feature flag for now.
if (process.env.DISTRIBUTEDTASK_USE_PERTASK_NUGET) {
    // var changed = [];
    // taskList.forEach(function (taskName) {
    //     // check packaging for the version of the task, if it doesn't exist we should build it
    //     var taskJsonPath = path.join(__dirname, 'Tasks', taskName, 'task.json');
    //     var taskJson = JSON.parse(fs.readFileSync(taskJsonPath));
    //     if (typeof taskJson.version.Patch != 'number') {
    //         fail(`Error processing '${taskName}'. version.Patch should be a number.`);
    //     }
    //     var sourceTaskVersion = taskJson.version.major + "." + taskJson.version.minor + "." + taskJson.version.patch;

    //     if (!util.taskVersionExistsInPackaging(taskJson.name, sourceTaskVersion)) {
    //         // This version of the task doesn't exist, we should build it
    //         console.log(`Task '${taskJson.name}' version '${sourceTaskVersion}' does not exist in packaging, adding to list of tasks to be built.`);
    //         changed.push(taskName);
    //     } 
    //     else {
    //         console.log(`Task '${taskJson.name}' version '${sourceTaskVersion}' exists in packaging so it will not be built.`);
    //     }
    // });
    // taskList = changed;
}

// set the runner options. should either be empty or a comma delimited list of test runners.
// for example: ts OR ts,ps
//
// note, currently the ts runner igores this setting and will always run.
process.env['TASK_TEST_RUNNER'] = options.runner || '';

target.clean = function () {
    rm('-Rf', path.join(__dirname, '_build'));
    mkdir('-p', buildPath);
    rm('-Rf', path.join(__dirname, '_test'));
};

//
// ex: node make.js build
// ex: node make.js build --task ShellScript
//
target.build = function() {
    target.clean();

    ensureTool('tsc', '--version', 'Version 2.3.4');
    ensureTool('npm', '--version', function (output) {
        if (semver.lt(output, '5.6.0')) {
            fail('Expected 5.6.0 or higher. To fix, run: npm install -g npm');
        }
    });

    taskList.forEach(function(taskName) {
        banner('Building: ' + taskName);
        var taskPath = path.join(__dirname, 'Tasks', taskName);
        ensureExists(taskPath);

        // load the task.json
        var outDir;
        var shouldBuildNode = test('-f', path.join(taskPath, 'tsconfig.json'));
        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            var taskDef = require(taskJsonPath);
            validateTask(taskDef);

            // fixup the outDir (required for relative pathing in legacy L0 tests)
            outDir = path.join(buildPath, taskName);

            // create loc files
            createTaskLocJson(taskPath);
            createResjson(taskDef, taskPath);

            // determine the type of task
            shouldBuildNode = shouldBuildNode || taskDef.execution.hasOwnProperty('Node');
        }
        else {
            outDir = path.join(buildPath, path.basename(taskPath));
        }

        mkdir('-p', outDir);

        // get externals
        var taskMakePath = path.join(taskPath, 'make.json');
        var taskMake = test('-f', taskMakePath) ? require(taskMakePath) : {};
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
                var modOutDir = path.join(commonPath, modName);

                if (!test('-d', modOutDir)) {
                    banner('Building module ' + modPath, true);

                    mkdir('-p', modOutDir);

                    // create loc files
                    var modJsonPath = path.join(modPath, 'module.json');
                    if (test('-f', modJsonPath)) {
                        createResjson(require(modJsonPath), modPath);
                    }

                    // npm install and compile
                    if ((mod.type === 'node' && mod.compile == true) || test('-f', path.join(modPath, 'tsconfig.json'))) {
                        buildNodeTask(modPath, modOutDir);
                    }

                    // copy default resources and any additional resources defined in the module's make.json
                    console.log();
                    console.log('> copying module resources');
                    var modMakePath = path.join(modPath, 'make.json');
                    var modMake = test('-f', modMakePath) ? require(modMakePath) : {};
                    copyTaskResources(modMake, modPath, modOutDir);

                    // get externals
                    if (modMake.hasOwnProperty('externals')) {
                        console.log('');
                        console.log('> getting module externals');
                        getExternals(modMake.externals, modOutDir);
                    }

                    if (mod.type === 'node' && mod.compile == true) {
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
                }
                // copy ps module resources to the task output dir
                else if (mod.type === 'ps') {
                    console.log();
                    console.log('> copying ps module to task');
                    var dest;
                    if (mod.hasOwnProperty('dest')) {
                        dest = path.join(outDir, mod.dest, modName);
                    }
                    else {
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
            var packageLock = JSON.parse(fs.readFileSync(lockFilePath).toString());
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
    });

    banner('Build successful', true);
}

//
// will run tests for the scope of tasks being built
// npm test
// node make.js test
// node make.js test --task ShellScript --suite L0
//
target.test = function() {
    ensureTool('tsc', '--version', 'Version 2.3.4');
    ensureTool('mocha', '--version', '2.3.3');

    // build the general tests and ps test infra
    rm('-Rf', buildTestsPath);
    mkdir('-p', path.join(buildTestsPath));
    cd(path.join(__dirname, 'Tests'));
    run(`tsc --rootDir ${path.join(__dirname, 'Tests')} --outDir ${buildTestsPath}`);
    console.log();
    console.log('> copying ps test lib resources');
    mkdir('-p', path.join(buildTestsPath, 'lib'));
    matchCopy(path.join('**', '@(*.ps1|*.psm1)'), path.join(__dirname, 'Tests', 'lib'), path.join(buildTestsPath, 'lib'));

    // find the tests
    var suiteType = options.suite || 'L0';
    var taskType = options.task || '*';
    var pattern1 = buildPath + '/' + taskType + '/Tests/' + suiteType + '.js';
    var pattern2 = buildPath + '/Common/' + taskType + '/Tests/' + suiteType + '.js';
    var pattern3 = buildTestsPath + '/' + suiteType + '.js';
    var testsSpec = matchFind(pattern1, buildPath)
        .concat(matchFind(pattern2, buildPath))
        .concat(matchFind(pattern3, buildTestsPath, { noRecurse: true }));
    if (!testsSpec.length && !process.env.TF_BUILD) {
        fail(`Unable to find tests using the following patterns: ${JSON.stringify([pattern1, pattern2, pattern3])}`);
    }

    // setup the version of node to run the tests
    util.installNode(options.node);

    run('mocha ' + testsSpec.join(' '), /*inheritStreams:*/true);
}

//
// node make.js testLegacy
// node make.js testLegacy --suite L0/XCode
//

target.testLegacy = function() {
    ensureTool('tsc', '--version', 'Version 2.3.4');
    ensureTool('mocha', '--version', '2.3.3');

    if (options.suite) {
        fail('The "suite" parameter has been deprecated. Use the "task" parameter instead.');
    }

    // clean
    console.log('removing _test');
    rm('-Rf', path.join(__dirname, '_test'));

    // copy the L0 source files for each task; copy the layout for each task
    console.log();
    console.log('> copying tasks');
    taskList.forEach(function (taskName) {
        var testCopySource = path.join(__dirname, 'Tests-Legacy', 'L0', taskName);
        // copy the L0 source files if exist
        if (test('-e', testCopySource)) {
            console.log('copying ' + taskName);
            var testCopyDest = path.join(legacyTestPath, 'L0', taskName);
            matchCopy('*', testCopySource, testCopyDest, { noRecurse: true, matchBase: true });

            // copy the task layout
            var taskCopySource = path.join(buildPath, taskName);
            var taskCopyDest = path.join(legacyTestTasksPath, taskName);
            matchCopy('*', taskCopySource, taskCopyDest, { noRecurse: true, matchBase: true });
        }

        // copy each common-module L0 source files if exist
        var taskMakePath = path.join(__dirname, 'Tasks', taskName, 'make.json');
        var taskMake = test('-f', taskMakePath) ? JSON.parse(fs.readFileSync(taskMakePath).toString()) : {};
        if (taskMake.hasOwnProperty('common')) {
            var common = taskMake['common'];
            common.forEach(function(mod) {
                // copy the common-module L0 source files if exist and not already copied
                var modName = path.basename(mod['module']);
                console.log('copying ' + modName);
                var modTestCopySource = path.join(__dirname, 'Tests-Legacy', 'L0', `Common-${modName}`);
                var modTestCopyDest = path.join(legacyTestPath, 'L0', `Common-${modName}`);
                if (test('-e', modTestCopySource) && !test('-e', modTestCopyDest)) {
                    matchCopy('*', modTestCopySource, modTestCopyDest, { noRecurse: true, matchBase: true });
                }
                var modCopySource = path.join(commonPath, modName);
                var modCopyDest = path.join(legacyTestTasksPath, 'Common', modName);
                if (test('-e', modCopySource) && !test('-e', modCopyDest)) {
                    // copy the common module layout
                    matchCopy('*', modCopySource, modCopyDest, { noRecurse: true, matchBase: true });
                }
            });
        }
    });

    // short-circuit if no tests
    if (!test('-e', legacyTestPath)) {
        banner('no legacy tests found', true);
        return;
    }

    // copy the legacy test infra
    console.log();
    console.log('> copying legacy test infra');
    matchCopy('@(definitions|lib|tsconfig.json)', path.join(__dirname, 'Tests-Legacy'), legacyTestPath, { noRecurse: true, matchBase: true });

    // copy the lib tests when running all legacy tests
    if (!options.task) {
        matchCopy('*', path.join(__dirname, 'Tests-Legacy', 'L0', 'lib'), path.join(legacyTestPath, 'L0', 'lib'), { noRecurse: true, matchBase: true });
    }

    // compile legacy L0 and lib
    var testSource = path.join(__dirname, 'Tests-Legacy');
    cd(legacyTestPath);
    run('tsc --rootDir ' + legacyTestPath);

    // create a test temp dir - used by the task runner to copy each task to an isolated dir
    var tempDir = path.join(legacyTestPath, 'Temp');
    process.env['TASK_TEST_TEMP'] = tempDir;
    mkdir('-p', tempDir);

    // suite paths
    var testsSpec = matchFind(path.join('**', '_suite.js'), path.join(legacyTestPath, 'L0'));
    if (!testsSpec.length) {
        fail(`Unable to find tests using the pattern: ${path.join('**', '_suite.js')}`);
    }

    // setup the version of node to run the tests
    util.installNode(options.node);

    // mocha doesn't always return a non-zero exit code on test failure. when only
    // a single suite fails during a run that contains multiple suites, mocha does
    // not appear to always return non-zero. as a workaround, the following code
    // creates a wrapper suite with an "after" hook. in the after hook, the state
    // of the runnable context is analyzed to determine whether any tests failed.
    // if any tests failed, log a ##vso command to fail the build.
    var testsSpecPath = ''
    var testsSpecPath = path.join(legacyTestPath, 'testsSpec.js');
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

// TODO: When is this used vs. the code in stage-aggregate.js?
target.package = function() {
    // clean
    rm('-Rf', packagePath);

    // create the non-aggregated layout
    util.createNonAggregatedZip(buildPath, packagePath);

    // if task specified, create hotfix layout and short-circuit
    if (options.task) {
        util.createHotfixLayout(packagePath, options.task);
        return;
    }

    // create the aggregated tasks layout
    util.createAggregatedZip(packagePath);

    // nuspec
    var version = options.version;
    if (!version) {
        console.warn('Skipping nupkg creation. Supply version with --version.');
        return;
    }

    if (!semver.valid(version)) {
        fail('invalid semver version: ' + version);
    }

    var pkgName = 'Mseng.MS.TF.Build.Tasks';
    console.log();
    console.log('> Generating .nuspec file');
    var contents = '<?xml version="1.0" encoding="utf-8"?>' + os.EOL;
    contents += '<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">' + os.EOL;
    contents += '   <metadata>' + os.EOL;
    contents += '      <id>' + pkgName + '</id>' + os.EOL;
    contents += '      <version>' + version + '</version>' + os.EOL;
    contents += '      <authors>bigbldt</authors>' + os.EOL;
    contents += '      <owners>bigbldt,Microsoft</owners>' + os.EOL;
    contents += '      <requireLicenseAcceptance>false</requireLicenseAcceptance>' + os.EOL;
    contents += '      <description>For VSS internal use only</description>' + os.EOL;
    contents += '      <tags>VSSInternal</tags>' + os.EOL;
    contents += '   </metadata>' + os.EOL;
    contents += '</package>' + os.EOL;
    var nuspecPath = path.join(packagePath, 'pack-source', pkgName + '.nuspec');
    fs.writeFileSync(nuspecPath, contents);

    // package
    ensureTool('nuget.exe');
    var nupkgPath = path.join(packagePath, 'pack-target', `${pkgName}.${version}.nupkg`);
    mkdir('-p', path.dirname(nupkgPath));
    run(`nuget.exe pack ${nuspecPath} -OutputDirectory ${path.dirname(nupkgPath)}`);
}

// used by CI that does official publish
// TODO: Look at how this is used in CI and how it relates to other CI scripts.
target.publish = function() {
    var server = options.server;
    assert(server, 'server');

    // if task specified, skip
    if (options.task) {
        banner('Task parameter specified. Skipping publish.');
        return;
    }

    // get the branch/commit info
    var refs = util.getRefs();

    // test whether to publish the non-aggregated tasks zip
    // skip if not the tip of a release branch
    var release = refs.head.release;
    var commit = refs.head.commit;
    if (!release ||
        !refs.releases[release] ||
        commit != refs.releases[release].commit) {

        // warn not publishing the non-aggregated
        console.log(`##vso[task.logissue type=warning]Skipping publish for non-aggregated tasks zip. HEAD is not the tip of a release branch.`);
    }
    else {
        // store the non-aggregated tasks zip
        var nonAggregatedZipPath = path.join(packagePath, 'non-aggregated-tasks.zip');
        util.storeNonAggregatedZip(nonAggregatedZipPath, release, commit);
    }

    // resolve the nupkg path
    var nupkgFile;
    var nupkgDir = path.join(packagePath, 'pack-target');
    if (!test('-d', nupkgDir)) {
        fail('nupkg directory does not exist');
    }

    var fileNames = fs.readdirSync(nupkgDir);
    if (fileNames.length != 1) {
        fail('Expected exactly one file under ' + nupkgDir);
    }

    nupkgFile = path.join(nupkgDir, fileNames[0]);

    // publish the package
    ensureTool('nuget3.exe');
    run(`nuget3.exe push ${nupkgFile} -Source ${server} -apikey Skyrise`);
}

// used to bump the patch version in task.json files
// TODO: When/why is this used?
target.bump = function() {
    taskList.forEach(function (taskName) {
        var taskJsonPath = path.join(__dirname, 'Tasks', taskName, 'task.json');
        var taskJson = JSON.parse(fs.readFileSync(taskJsonPath));
        if (typeof taskJson.version.Patch != 'number') {
            fail(`Error processing '${taskName}'. version.Patch should be a number.`);
        }

        taskJson.version.Patch = taskJson.version.Patch + 1;
        fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 4));
    });
}