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

var path = require('path');
var shell = require('shelljs/global');
var fs = require('fs');

exports.execute = function(ctx, callback) {
	
	var cmakePath = which('cmake');
	if (!cmakePath) {
		callback(new Error('cmake not found'));
	}
	ctx.verbose('using cmake: ' + cmakePath);

	var srcRoot = ctx.inputs.srcRoot);
	ctx.verbose('srcRoot: ' + srcRoot);

	if (!fs.existsSync(srcRoot)) {
		callback(new Error('srcRoot does not exist: ' + srcRoot));	
		return;
	}
	cd(srcRoot);

	// TODO: validate dir name is not a path.  We are going to create the dir if not exist and then run cmake build ..
	var buildDirName = ctx.inputs.buildDirName;
	var buildPath = path.join(srcRoot, buildDirName);
	if (!fs.existsSync(buildPath)) {
		ctx.verbose('creating build folder: ' + buildDirName)
		mkdir(buildDirName);	
	}
	cd(buildDirName);

	var cwd = process.cwd();
	ctx.info('Generating Files');
	ctx.util.spawn(cmakePath, [srcRoot], { cwd: cwd, failOnStdErr: false }, function(err) {
		if (err) {
			callback(err);
			return;
		}

		// TODO: join args from input
		ctx.info('Building');
		ctx.util.spawn(cmakePath, ['--build', buildPath], { cwd: cwd, failOnStdErr: false }, callback);	
	});
}
