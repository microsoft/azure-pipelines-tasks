// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs');
var path = require('path');
var shell = require('shelljs/global');

exports.execute = function (ctx, callback) {

    //Verify ant is installed correctly
    var antPath = which('ant');
    if (!antPath) {
        callback(new Error('Unable to find Ant. Verify it is installed correctly on the build agent: http://ant.apache.org/manual/install.html.'));
        return;
    }
    ctx.verbose('Found Ant at: ' + antPath);
    
    //Verify Ant build file is specified
    var antBuildFile = ctx.inputs.antBuildFile;
    if (!fs.existsSync(antBuildFile) || !fs.statSync(antBuildFile).isFile()) {
        callback(new Error('Ant build file ' + antBuildFile + ' does not exist or is not a valid file'));
        return;
    }
    ctx.verbose('Ant build file: ' + antBuildFile);

    //Find Working directory to run Ant in. cwd is optional, we use directory of Ant build file as Working directory if not set.
    var cwd = ctx.inputs.cwd;
    if (!cwd || cwd.length == 0)
    {
        cwd = path.dirname(antBuildFile);
    }
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
        callback(new Error('Working directory ' + cwd + ' does not exist or is not a valid directory'));
        return;
    }   
    cd(cwd);
    ctx.verbose('Working directory: ' + cwd);

    var antArguments = [];
    antArguments = antArguments.concat("-buildfile");
    antArguments = antArguments.concat(antBuildFile);

    // options and targets are optional
    var options = ctx.inputs.options;
    if (options && options.length > 0) {
        var optionsArgs = ctx.util.argStringToArray(options);        
        antArguments = antArguments.concat(optionsArgs);
    }

    var targets = ctx.inputs.targets;
    if (targets && targets.length > 0) {
        var targetsArgs = ctx.util.argStringToArray(targets);        
        antArguments = antArguments.concat(targetsArgs);
    }    
    ctx.verbose("Ant arguments: " + antArguments.toString());

    // update JAVA_HOME if user selected specific JDK version
    if (ctx.inputs.jdkVersion && ctx.inputs.jdkVersion !== "default") {
        // ctx.inputs.jdkVersion should be in the form of 1.7, 1.8, or 1.10
        // ctx.inputs.jdkArchitecture is either x64 or x86
        // envName for version 1.7 and x64 would be "JAVA_HOME_7_X64"
        var envName = "JAVA_HOME_" + ctx.inputs.jdkVersion.slice(2) + "_" + ctx.inputs.jdkArchitecture.toUpperCase();
        var specifiedJavaHome = process.env[envName];
        if (!specifiedJavaHome || specifiedJavaHome.length == 0) {
            callback(new Error('Failed to find specified JDK version.  Please make sure environment varialbe ' + envName + ' exists and is set to a valid JDK.'));
            return;
        }

        ctx.info("Set JAVA_HOME to " + specifiedJavaHome);
        process.env["JAVA_HOME"] = specifiedJavaHome;
    }

    var ops = {
        cwd: path.resolve(cwd),
        env: process.env
    };

    // calling spawn instead of fork so we can easily capture output --> logs
    ctx.info('Running Ant: ');
    ctx.util.spawn(antPath, antArguments, ops, callback);
}
