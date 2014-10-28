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

var jake = require('jake')
  , fs = require('fs')
  , path = require('path')
  , shell = require('shelljs/global');

exports.execute = function(ctx, callback) {

	var scriptPath = ctx.inputs.scriptPath;
	if (!scriptPath || !fs.existsSync(scriptPath)) {
		callback(new Error('scriptPath is not valid'));
		return;
	}

	// cwd is optional - we use folder of script as working directory if not set.
	var cwd = ctx.inputs.cwd;
	if (!cwd || cwd.length == 0) {
		cwd = path.dirname(scriptPath);
	}
	cd(cwd);
	ctx.verbose('cwd: ' + process.cwd());
	ctx.info('Running Jake:' + scriptPath);
	
	var args = []; 
	args.push(path.join(__dirname, 'jakerunner.js'));

	args.push('-f');
	args.push(scriptPath);

	if (ctx.inputs.target) {
	    args.push(ctx.inputs.target);
	}

	var ops = {
		cwd: path.resolve(cwd),
		env: process.env
	};

	ctx.verbose('node arguments:');
	args.forEach(function(arg) {
		ctx.verbose('   ' + arg);
	});

	// calling spawn instead of fork so we can easily capture output --> logs	
	ctx.util.spawn('node', args, ops, callback);
}
