// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs'),
    path = require('path');

exports.execute = function (ctx, callback) {

    var wrapperScript = ctx.inputs.wrapperScript;

    // Verify wrapperScript is set
    if (!wrapperScript || wrapperScript.length == 0) {
        callback(new Error('Please specify the Gradle wrapper script.'));
        return;
    }

    if (!fs.existsSync(wrapperScript) || !fs.statSync(wrapperScript).isFile()) {
        callback(new Error('Specified Gradle wrapper is invalid.'));
        return;
    }

    // cwd is optional - we use folder of script as working directory if not set.
    var cwd = ctx.inputs.cwd;
    if (!cwd || cwd.length == 0) {
        cwd = path.dirname(wrapperScript);
    }

    cd(cwd);
    ctx.verbose('Setting working directory to ' + cwd);

    //Make sure the wrapper script is executable
    fs.chmodSync(wrapperScript, "755");

    var argsArray = [];

    //Validate options
    var options = ctx.inputs.options;
    if (options) {
        argsArray = ctx.util.argStringToArray(options);
    }
    
    //Validate tasks
    var tasks = ctx.inputs.tasks;
    if (!tasks) {
        callback(new Error('No tasks specified.'));
        return;
    }
    argsArray = argsArray.concat(ctx.util.argStringToArray(tasks));

    ctx.verbose('Invoking Gradle wrapper ' + wrapperScript + ' ' + argsArray.join(" "));

    var ops = {
        cwd: path.resolve(cwd),
        env: process.env,
        failOnStdErr: false,
        failOnNonZeroRC: true        
    };

    // calling spawn instead of fork so we can easily capture output --> logs
    ctx.info('Running Gradle: ');
    ctx.util.spawn(wrapperScript, argsArray, ops, callback);
}
