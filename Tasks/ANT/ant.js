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
        callback(new Error('Unable to find ANT, verify it is installed correctly, ANT_HOME is set and ANT_HOME\bin is added to the PATH on the build agent'));
        return;
    }

    ctx.verbose('using ant: ' + antPath);

    //Find working directory to run ANT in
    var cwd = ctx.inputs.cwd;
    if (!fs.existsSync(cwd)) {
        callback(new Error('Working Directory not exist: ' + cwd));
        return;
    }

    cd(cwd);
    ctx.verbose('Working Folder: ' + cwd);
    var cwd = process.cwd();

    // options and targets are optional - invoke ant without any arguments if nothing is specified
    var options = ctx.inputs.options;
    var targets = ctx.inputs.targets;

    var antArguments = options + targets;
    ctx.verbose('ANT arguments: ' + antArguments);
        
    var ops = {
        cwd: path.resolve(cwd),
        env: process.env
    };

    // calling spawn instead of fork so we can easily capture output --> logs
    ctx.info('Running ant: ');
    ctx.util.spawn(antPath, antArguments, ops, callback);
}
