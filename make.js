// parse command line options
var minimist = require('minimist');
var mopts = {
    string: [
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
require('shelljs/make');
var fs = require('fs');
var os = require('os');
var path = require('path');
var semver = require('semver');
var util = require('./make-util');

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
var matchFind = util.matchFind;
var matchCopy = util.matchCopy;
var matchRemove = util.matchRemove;
var ensureTool = util.ensureTool;
var assert = util.assert;
var getExternals = util.getExternals;
var createResjson = util.createResjson;
var createTaskLocJson = util.createTaskLocJson;
var validateTask = util.validateTask;

// default tasks to build
var makeOptions = require('./make-options.json');
var taskList = makeOptions['tasks'];

// global paths
var buildPath = path.join(__dirname, '_build', 'Tasks');
var buildTestsPath = path.join(__dirname, '_build', 'Tests');
var commonPath = path.join(__dirname, '_build', 'Tasks', 'Common');
var packagePath = path.join(__dirname, '_package');
var testTasksPath = path.join(__dirname, '_test', 'Tasks');
var testPath = path.join(__dirname, '_test', 'Tests');
var testTempPath = path.join(__dirname, '_test', 'Tests', 'Temp');

// node min version
var minNodeVer = '4.0.0';
if (semver.lt(process.versions.node, minNodeVer)) {
    fail('requires node >= ' + minNodeVer + '.  installed: ' + process.versions.node);
}

// add node modules .bin to the path so we can dictate version of tsc etc...
var binPath = path.join(__dirname, 'node_modules', '.bin');
if (!test('-d', binPath)) {
    fail('node modules bin not found.  ensure npm install has been run.');
}
addPath(binPath);

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

    ensureTool('tsc', '--version');

    // filter tasks
    var tasksToBuild;
    if (options.task) {
        tasksToBuild = matchFind(options.task, path.join(__dirname, 'Tasks'), { noRecurse: true })
            .map(function (item) {
                return path.basename(item);
            });
        if (!tasksToBuild.length) {
            fail('Unable to find any tasks matching pattern ' + options.task);
        }
    }
    else {
        tasksToBuild = taskList;
    }

    tasksToBuild.forEach(function(taskName) {
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
            outDir = path.join(buildPath, taskDef.name);

            // create loc files
            createTaskLocJson(taskPath);
            createResjson(taskDef, taskPath);

            // determine whether node task
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
                    console.log();
                    console.log('> copying module resources to task');
                    var dest;
                    if (mod.hasOwnProperty('dest')) {
                        dest = path.join(outDir, mod.dest, modName);
                    }
                    else {
                        dest = path.join(outDir, 'ps_modules', modName);
                    }

                    matchCopy('!Tests', modOutDir, dest, { noRecurse: true });
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
    ensureTool('mocha', '--version');

    // build/copy the ps test infra
    rm('-Rf', buildTestsPath);
    mkdir('-p', path.join(buildTestsPath, 'lib'));
    var runnerSource = path.join(__dirname, 'Tests', 'lib', 'psRunner.ts');
    run(`tsc ${runnerSource} --outDir ${path.join(buildTestsPath, 'lib')}`);
    console.log();
    console.log('> copying ps test lib resources');
    matchCopy('+(*.ps1|*.psm1)', path.join(__dirname, 'Tests', 'lib'), path.join(buildTestsPath, 'lib'));

    // run the tests
    var suiteType = options.suite || 'L0';
    var taskType = options.task || '*';
    var pattern1 = buildPath + '/' + taskType + '/Tests/' + suiteType + '.js';
    var pattern2 = buildPath + '/Common/' + taskType + '/Tests/' + suiteType + '.js';
    var testsSpec = matchFind(pattern1, buildPath)
        .concat(matchFind(pattern2, buildPath));
    if (!testsSpec.length) {
        fail(`Unable to find tests using the following patterns: ${JSON.stringify([pattern1, pattern2])}`, true);
    }

    run('mocha ' + testsSpec.join(' '), true);
}

//
// node make.js testLegacy
// node make.js testLegacy --suite L0/XCode
//

target.testLegacy = function() {
    ensureTool('mocha', '--version');

    // clean tests
    rm('-Rf', testPath);
    mkdir('-p', testPath);

    // copy the tasks to test folder, delete the included task libs and put mock lib at root
    console.log('copy tasks');
    mkdir('-p', testTasksPath);
    cp('-R', path.join(buildPath, '*'), testTasksPath);

    util.removeAllFoldersNamed(testTasksPath, 'vsts-task-lib');

    // compile tests and test lib
    cd(path.join(__dirname, 'Tests'));
    run('tsc --outDir ' + testPath);

    // copy the test lib dir
    cp('-R', path.join(__dirname, 'Tests', 'lib'), testPath + '/');

    // copy other
    matchCopy('+(data|*.ps1|*.json)', path.join(__dirname, 'Tests', 'L0'), path.join(testPath, 'L0'), { dot: true });

    // setup test temp
    process.env['TASK_TEST_TEMP'] = testTempPath;
    mkdir('-p', testTempPath);

    // suite path
    var suitePath = path.join(testPath, options.suite || 'L0/**', '_suite.js');
    var tfBuild = ('' + process.env['TF_BUILD']).toLowerCase() == 'true';
    run('mocha ' + suitePath, true);
}

target.package = function() {
    ensureTool('powershell.exe', '-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command "$PSVersionTable.PSVersion.ToString()"');

    // clean
    rm('-Rf', packagePath);
    matchRemove(path.join(buildPath, 'Common'), buildPath, { noRecurse: true });
    rm('-Rf', commonPath);
    matchRemove(path.join(buildPath, '*', 'Tests'), buildPath);

    // create the zip
    var zipPath = path.join(packagePath, 'pack-source', 'contents', 'Microsoft.TeamFoundation.Build.Tasks.zip');
    mkdir('-p', path.dirname(zipPath));
    run(`powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command "Add-Type -Assembly 'System.IO.Compression.FileSystem'; [System.IO.Compression.ZipFile]::CreateFromDirectory('${buildPath}', '${zipPath}')"`)

    // nuspec
    var version = options.version;
    if (!version) {
        fail('supply version with --version');
    }

    if (!semver.valid(version)) {
        fail('invalid semver version: ' + version);
    }

    var pkgName = 'Mseng.MS.TF.Build.Tasks';
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
    ensureTool('nuget.exe', '', true);
    var nupkgPath = path.join(packagePath, 'pack-target', `${pkgName}.${version}.nupkg`);
    mkdir('-p', path.dirname(nupkgPath));
    run(`nuget.exe pack ${nuspecPath} -OutputDirectory ${path.dirname(nupkgPath)}`);

    // used by CI that does official publish
    var server = options.server;
    if (server) {
        ensureTool('nuget3.exe', '', true);
        run(`nuget3.exe push ${nupkgPath} -Source ${server} -apikey Skyrise`);
    }
}