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

    //Find Working directory to run Maven in, use directory of Maven POM file
    var cwd = path.dirname(mavenPOMFile);    
    cd(cwd);
    ctx.verbose('Working directory: ' + cwd);

    var mavenArguments = [];
    mavenArguments = mavenArguments.concat("-f");
    mavenArguments = mavenArguments.concat(mavenPOMFile);

    var options = ctx.inputs.options;
    if (options && options.length > 0) {
        var optionsArgs = ctx.util.argStringToArray(options);
        mavenArguments = mavenArguments.concat(optionsArgs);
    }

    var goals = ctx.inputs.goals;
    if (goals && goals.length > 0) {
        var goalsArgs = ctx.util.argStringToArray(goals);
        mavenArguments = mavenArguments.concat(goalsArgs);
    }    
    ctx.verbose("Maven arguments: " + mavenArguments.toString());

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
    ctx.info('Running Maven: ');
    ctx.util.spawn('mvn', mavenArguments, ops, callback);
}
