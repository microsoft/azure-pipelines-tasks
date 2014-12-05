// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var path = require('path');
var shell = require('shelljs/global');

exports.execute = function(ctx, callback) {
	var _buffer;

	var args = [];

	var argsInput = ctx.inputs.arguments;
	ctx.verbose('argsInput: ' + argsInput);
	if (argsInput && argsInput.length > 0) {
		args = args.concat(ctx.util.argStringToArray(argsInput));
	}

	// cwd is optional - we use folder of script as working directory if not set.
	var cwd = ctx.inputs.workingFolder;
	ctx.verbose('cwd: ' + cwd);
	if (!cwd || cwd.length == 0) {
		cd(cwd);
	}

	// fileName should resolve via path or explicit path
	var toolPath = which(ctx.inputs.filename);
	if (!toolPath) {
		callback(new Error(toolPath + ' not found'));
		return;
	}

	ctx.util.spawn(toolPath, args, { cwd: cwd }, callback);
}
