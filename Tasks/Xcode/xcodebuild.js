// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var EX__BASE = 63;
var EX_USAGE = 64;
var EX_DATAERR = 65;

var fs = require('fs')
  , path = require('path')
  , async = require('async')
  , shell = require('shelljs/global');

exports.execute = function(ctx, callback) {
	var xcbpath = which('xcodebuild');
	ctx.verbose('using xcodebuild: ' + xcbpath);

	var repoPath = ctx.variables['build.sourceDirectory'];

	//----------------------------------------------------------------------
	// Input Validation/Feedback
	//----------------------------------------------------------------------

	if (!xcbpath) {
		callback(new Error('xcodebuild not found'));
		return;
	}

	// optional - if you specify, must be valid path
	var xcWorkspacePath = ctx.inputs.xcWorkspacePath;
	if (xcWorkspacePath && !fs.existsSync(xcWorkspacePath)) {
		callback(new Error('xcWorkspacePath not found: ' + xcWorkspacePath));
		return;
	}

	// optional - if you specify, must be valid path
	var projectPath = ctx.inputs.projectPath;
	if (projectPath && !fs.existsSync(projectPath)) {
		callback(new Error('projectPath not found: ' + projectPath));
		return;
	}

	// SDK and Configuration are required
	var sdk = ctx.inputs.sdk;
	if (!sdk) {
		callback(new Error('sdk not specified'));
		return;		
	}

	var configuration = ctx.inputs.configuration;
	if (!configuration) {
		callback(new Error('sdk not specified'));
		return;		
	}

	// if it's a workspace build, scheme is required
	var scheme = ctx.inputs.scheme;
	if (xcWorkspacePath && !scheme) {
		callback(new Error('workspace builds need a scheme specified'));
		return;
	}

	var cwd = process.cwd();

	// create the output folder if not exist
	var outputFolder = path.join(cwd, 'output', ctx.inputs.outputPattern);
	ctx.info('outputFolder: ' + outputFolder);

	if (!fs.existsSync(outputFolder)) {
		mkdir('-p', outputFolder);
	}

	if (!fs.existsSync(outputFolder)) {
		callback(new Error('failed to create output folder: ' + outputFolder));
		return;	
	}

	//----------------------------------------------------------------------
	// Run xcodebuild
	//----------------------------------------------------------------------
/*
	https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/xcodebuild.1.html

	xcodebuild -workspace ${INPUT_XCWORKSPACEPATH} \
	           -sdk ${INPUT_SDK} \
	           -scheme ${INPUT_SCHEME} \
	           -configuration ${INPUT_CONFIGURATION} \
	           DSTROOT=${OUTPUT_PATH}/build.dst \
	           OBJROOT=${OUTPUT_PATH}/build.obj \
	           SYMROOT=${OUTPUT_PATH}/build.sym \
	           SHARED_PRECOMPS_DIR=${OUTPUT_PATH}/build.pch
*/

	var args = []; 

	if (xcWorkspacePath && xcWorkspacePath != repoPath) {
		args.push('-workspace');
		args.push(xcWorkspacePath);
	}

    //
	// project and target is removed from the inputs - we support workspace/scheme based
	// based builds.  leaving code support for now
	// 
	if (projectPath && projectPath != repoPath) {
		args.push('-project');
		args.push(projectPath);
	}

	args.push('-sdk');
	args.push(sdk);

	args.push('-configuration');
	args.push(configuration);


	if (scheme) {
		args.push('-scheme');
		args.push(scheme);
	}

	if (ctx.inputs.target) {
	    args.push(ctx.inputs.target);
	}

	// actions is optional - build is default
	var actions = ctx.inputs.actions;
	if (actions) {
		var actionArgs = ctx.inputs.actions.split(' ');
		args = args.concat(actionArgs);
	}

	// push variables for output
	args.push('DSTROOT=' + path.join(outputFolder, 'build.dst'));
	args.push('OBJROOT=' + path.join(outputFolder, 'build.obj'));
	args.push('SYMROOT=' + path.join(outputFolder, 'build.sym'));
	args.push('SHARED_PRECOMPS_DIR=' + path.join(outputFolder, 'build.pch'));

	ctx.verbose('xcodepath: ' + xcbpath);
	ctx.verbose('xcodebuildargs:');
	args.forEach(function(arg) {
		ctx.verbose('   ' + arg);
	});


	var ops = {
		cwd: cwd,
		env: process.env
	};

	async.series([
		function(complete) {
			ctx.util.spawn(xcbpath, ['-version'], ops, function(err, rc){ 
				ctx.verbose('rc: ' + rc);
				complete(err); 
			});
		},
		function(complete) {
			// we are relying on sysex3 return codes via xcodebuild man page 
			// https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man3/sysexits.3.html#//apple_ref/doc/man/3/sysexits			
			var ops = {
				cwd: cwd,
				env: process.env,
				failOnStdErr: false,
				failOnNonZeroRC: false
			};

			ctx.util.spawn(xcbpath, args, ops, function(err, rc){ 
				ctx.verbose('rc: ' + rc);

				if (rc < EX__BASE) {
					complete(null);
				}
				else {
					var errMsg = "xcodebuild failed: " + rc;
					switch (rc) {
						case EX_DATAERR:
							errMsg = "xcodebuild " + actions + " failed.  See the log.";
							break;

						case EX_USAGE:
							errMsg = "xcodebuild usage incorrect.  See the log.";
							break;
					}
					
					complete(new Error(errMsg)); 					
				}
			});
		}],
		function(err) {
			callback(err);
		});
}