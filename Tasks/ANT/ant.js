// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

var fs = require('fs');
var path = require('path');
var shell = require('shelljs/global');

exports.execute = function (ctx, callback) {

    //Verify ant is installed correctly
    var antPath = which('ant');
    if (!antPath) {
        callback(new Error('Unable to find Ant, verify it is installed correctly on the build agent: http://ant.apache.org/manual/install.html.'));
        return;
    }

    ctx.verbose('Found Ant at: ' + antPath);

    //Find working directory to run Ant in
    var cwd = ctx.inputs.cwd;
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
        callback(new Error('Working Directory ' + cwd + ' does not exist or is not a valid directory'));
        return;
    }   

    cd(cwd);
    ctx.verbose('Working Directory: ' + cwd);
    var cwd = process.cwd();

    // options and targets are optional - invoke ant without any arguments if nothing is specified
    var options = ctx.inputs.options;
    var targets = ctx.inputs.targets;

    var antArguments = [];
    if (options) {
       var optionsArgs = options.split(' ');
       antArguments = antArguments.concat(optionsArgs);
    }
    if (targets) {
        var targetsArgs = targets.split(' ');
        antArguments = antArguments.concat(targetsArgs);
    }

    var ops = {
        cwd: path.resolve(cwd),
        env: process.env
    };

    // calling spawn instead of fork so we can easily capture output --> logs
    ctx.info('Running Ant: ');
    ctx.util.spawn(antPath, antArguments, ops, callback);
}
