// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var path = require('path');
var shell = require('shelljs/global');

exports.execute = function(ctx, callback) {
	var _buffer;

	var args = [ctx.inputs.scriptPath];

	var argsInput = ctx.inputs.args;
	ctx.verbose('argsInput: ' + argsInput);
	if (argsInput && argsInput.length > 0) {
		args = args.concat(ctx.util.argStringToArray(argsInput));
	} 

	// cwd is optional - we use folder of script as working directory if not set.
	var cwd = ctx.inputs.cwd;
	if (!cwd || cwd.length == 0) {
		cwd = path.dirname(scriptPath);
	}

	cd(cwd);
	ctx.verbose('cwd: ' + cwd);

	// shell script runner
	ctx.verbose('running: ' + JSON.stringify(args, null, 2));

	ctx.util.spawn('sh', args, { cwd: cwd }, callback);
}

// TODO: (bryanmac) system needs to chmod on the script? is that configurable?
