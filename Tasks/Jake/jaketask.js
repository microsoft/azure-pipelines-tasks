// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
