// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs');
var path = require('path');
var shell = require('shelljs/global');

exports.execute = function (ctx, callback) {

    //Verify Maven is installed correctly
    var mavenPath = which('mvn');
    if (!mavenPath) {
        callback(new Error('Unable to find Maven. Verify it is installed correctly on the build agent: http://maven.apache.org/download.cgi.'));
        return;
    }
    ctx.verbose('Found Maven at: ' + mavenPath);
    
    //Verify Maven POM file is specified
    var mavenPOMFile = ctx.inputs.mavenPOMFile;
    if (!fs.existsSync(mavenPOMFile) || !fs.statSync(mavenPOMFile).isFile()) {
        callback(new Error('Maven POM file ' + mavenPOMFile + ' does not exist or is not a valid file'));
        return;
    }
    ctx.verbose('Maven POM file: ' + mavenPOMFile);

    //Find Working directory to run Maven in. cwd is optional, we use directory of Maven POM file as Working directory if not set.
    var cwd = ctx.inputs.cwd;
    if (!cwd || cwd.length == 0)
    {
        cwd = path.dirname(mavenPOMFile);
    }
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
        callback(new Error('Working directory ' + cwd + ' does not exist or is not a valid directory'));
        return;
    }   
    cd(cwd);
    ctx.verbose('Working directory: ' + cwd);

    var mavenArguments = [];
    mavenArguments = mavenArguments.concat("-f");
    mavenArguments = mavenArguments.concat(mavenPOMFile);

    var options = ctx.inputs.options;
    if (options && options.length > 0) {
        var optionsArgs = ctx.util.argStringToArray(options);
        ctx.verbose(optionsArgs);
        mavenArguments = mavenArguments.concat(optionsArgs);
    }

    var goals = ctx.inputs.goals;
    if (goals && goals.length > 0) {
        var goalsArgs = ctx.util.argStringToArray(goals);
        ctx.verbose(goalsArgs);
        mavenArguments = mavenArguments.concat(goalsArgs);
    }    
    ctx.verbose("Maven arguments: " + mavenArguments.toString());

    var ops = {
        cwd: path.resolve(cwd),
        env: process.env
    };

    // calling spawn instead of fork so we can easily capture output --> logs
    ctx.info('Running Maven: ');
    ctx.util.spawn(mavenPath, mavenArguments, ops, callback);
}
