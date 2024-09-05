require('shelljs/make');
var fs = require('fs');
var path = require('path');
var buildutils = require('./buildutils');
var run = buildutils.run;

var rp = function (relPath) {
    return path.join(__dirname, relPath);
}

var buildPath = path.join(__dirname, '_build');
var testPath = path.join(__dirname, '_test');

if (process.env['TF_BUILD']) {
    // the CI controls the version of node, so it runs using "node make.js test" instead of "npm test"
    // update the PATH when running during CI
    buildutils.addPath(path.join(__dirname, 'node_modules', '.bin'));
}

target.clean = function () {
    rm('-Rf', buildPath);
    rm('-Rf', testPath);
};

target.build = function() {
    target.clean();
    target.loc();

    run('tsc --outDir ' + buildPath);
    cp(rp('package.json'), buildPath);
    cp(rp('package-lock.json'), buildPath);
    cp(rp('README.md'), buildPath);
    cp(rp('../LICENSE'), buildPath);
    cp(rp('lib.json'), buildPath);
    cp(rp('ThirdPartyNotice.txt'), buildPath);
    cp('-Rf', rp('Strings'), buildPath);
    // just a bootstrap file to avoid /// in final js and .d.ts file
    rm(path.join(buildPath, 'index.*'));
}

target.test = async function() {
    target.build();

    process.env['SYSTEM_DEBUG'] = 'true';

    await buildutils.getExternalsAsync();
    run('tsc -p ./test');
    cp('-Rf', rp('test/scripts'), testPath);
    cp('-Rf', rp('test/fakeTasks'), testPath);
    process.env['TASKLIB_INPROC_UNITS'] = '1'; // export task-lib internals for internal unit testing
    set('+e'); // Don't throw an exception when tests fail
    run('mocha ' + testPath);
}

target.loc = function() {
    var lib = require('./lib.json');
    var strPath = path.join('Strings', 'resources.resjson', 'en-US')
    mkdir('-p', strPath);
    var strings = { };
    if (lib.messages) {
        for (var key in lib.messages) {
            strings['loc.messages.' + key] = lib.messages[key];
        }
    }

    // create the en-US resjson file.
    var enContents = JSON.stringify(strings, null, 2);
    fs.writeFileSync(path.join(strPath, 'resources.resjson'), enContents)
}

process.on('uncaughtException', err => {
    console.error(`Uncaught exception: ${err.message}`);
    console.debug(err.stack);
});

process.on('unhandledRejection', err => {
    console.error(`Unhandled rejection: ${err.message}`);
    console.debug(err.stack);
});