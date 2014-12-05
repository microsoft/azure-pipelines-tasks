// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var path = require('path');
var shell = require('shelljs/global');
var fs = require('fs');

exports.execute = function(ctx, callback) {
	
	var cmakePath = which('cmake');
	if (!cmakePath) {
		callback(new Error('cmake not found'));
		return;
	}

	ctx.verbose('using cmake: ' + cmakePath);

	var args = [];

	var argsInput = ctx.inputs.args;
	ctx.verbose('argsInput: ' + argsInput);
	if (argsInput && argsInput.length > 0) {
		args = args.concat(ctx.util.argStringToArray(argsInput));
	}

	var cwd = ctx.inputs.cwd;
	ctx.verbose('working: ' + cwd);

	if (!fs.existsSync(cwd)) {
		callback(new Error('working does not exist: ' + cwd));	
		return;
	}
	cd(cwd);

	var cwd = process.cwd();
	ctx.info('Calling cmake');
	ctx.util.spawn(cmakePath, args, { cwd: cwd, failOnStdErr: false }, callback);
}