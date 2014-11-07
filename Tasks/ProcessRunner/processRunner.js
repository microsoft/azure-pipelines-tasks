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
