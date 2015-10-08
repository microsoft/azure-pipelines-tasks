/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/

var tl = require('vso-task-lib'),
	path = require('path'),
	fs = require('fs'),
	glob = require('glob'),
	Q = require ('q'),
	xcutils = require('./xcode-task-utils.js');

// Commands
var xcv = null, 
	xcb = null, 
	xcr = null,
	deleteKeychain = null, 
	deleteProvProfile = null;

// Globals
var origXcodeDeveloperDir, out, sdk, appFolders, cwd;

// Store original Xcode developer directory so we can restore it after build completes if its overridden
var origXcodeDeveloperDir = process.env['DEVELOPER_DIR'];

processInputs() 													// Process inputs to task and create xcv, xcb, import certs, profiles as required
	.then(function(code) {
		return xcv.exec();											// Print version of xcodebuild / xctool
	})			
	.then(execBuild)												// Run main xcodebuild / xctool task
	.then(packageApps)												// Package apps if configured
	.then(function(code) {											// On success, exit
		tl.exit(code);
	})
	.fin(function(code) {
		process.env['DEVELOPER_DIR'] = origXcodeDeveloperDir;
		var promise = deleteKeychain ? deleteKeychain.exec() : Q(0);
		if(deleteProvProfile) {
			promise = promise.then(function(code) {
				return deleteProvProfile.exec();
			});
		}
		return promise;
	})
	.fail(function(err) {
		console.error(err.message);
		tl.debug('taskRunner fail');
		tl.exit(1);
	});

function processInputs() {  
	// if output is rooted ($(build.buildDirectory)/output/...), will resolve to fully qualified path, 
	// else relative to repo root
	var buildSourceDirectory = tl.getVariable('build.sourceDirectory') || tl.getVariable('build.sourcesDirectory');
	out = path.resolve(buildSourceDirectory, tl.getInput('outputPattern', true));

	//Process working directory
	cwd = tl.getInput('cwd') || buildSourceDirectory;
	tl.cd(cwd);

	// Create output directory if not present
	tl.mkdirP(out);

	// Set the path to the developer tools for this process call if not the default
	var xcodeDeveloperDir = tl.getInput('xcodeDeveloperDir', false);
	if(xcodeDeveloperDir) {
		tl.debug('DEVELOPER_DIR was ' + origXcodeDeveloperDir)
		tl.debug('DEVELOPER_DIR for build set to ' + xcodeDeveloperDir);
		process.env['DEVELOPER_DIR'] = xcodeDeveloperDir;
	}
	// Use xctool or xccode build based on flag
	var useXctool = (tl.getInput('useXctool', false) == "true");
	var tool = useXctool ? tl.which('xctool', true) : tl.which('xcodebuild', true);
	tl.debug('Tool selected: '+ tool);
	// Get version 
	xcv = new tl.ToolRunner(tool);
	xcv.arg('-version');
	
	xcb = new tl.ToolRunner(tool);		
	// Add required flags
	sdk = tl.getInput('sdk', true);
	xcb.arg('-sdk');
	xcb.arg(sdk);
	xcb.arg('-configuration');
	xcb.arg(tl.getInput('configuration', true));
	// Args: Add optional workspace flag
	var workspace = tl.getPathInput('xcWorkspacePath', false, false)
	if(workspace && (!fs.existsSync(workspace) || !fs.lstatSync(workspace).isDirectory())) {
		var workspaceFile = glob.sync(workspace);
		if(workspaceFile && workspaceFile.length > 0) {
			tl.debug("Found " + workspaceFile.length + ' workspaces matching.')
			xcb.arg('-workspace');
			xcb.arg('"' + workspaceFile[0] + '"');				
		} else {
			console.error('No workspaces found matching ' + workspace);
		}
	} else {
		tl.debug('No workspace path specified in task.');
	}
	// Args: Add optional scheme flag
	var scheme = tl.getInput('scheme', false);
	if(scheme) {
		xcb.arg('-scheme');
		xcb.arg('"' + tl.getInput('scheme', true) + '"');
	} else {
		tl.debug('No scheme specified in task.');
	}
	if(useXctool) {
		var xctoolReporter = tl.getInput('xctoolReporter', false);
		if(xctoolReporter) {
			xcb.arg(['-reporter', 'plain', '-reporter', xctoolReporter])
		}
		
	}
	
	// Args: Add output path config
	xcb.arg(tl.getDelimitedInput('actions', ' ', true));
	xcb.arg('DSTROOT=' + path.join(out, 'build.dst'));
	xcb.arg('OBJROOT=' + path.join(out, 'build.obj'));
	xcb.arg('SYMROOT=' + path.join(out, 'build.sym'));
	xcb.arg('SHARED_PRECOMPS_DIR=' + path.join(out, 'build.pch'));
	
	return iosIdentity().then(iosProfile);	
}

function iosIdentity(code) {
	
	var input = {
		cwd: cwd,
		unlockDefaultKeychain: (tl.getInput('unlockDefaultKeychain', false)=="true"),
		defaultKeychainPassword: tl.getInput('defaultKeychainPassword',false),
		p12: tl.getPathInput('p12', false, false),
		p12pwd: tl.getInput('p12pwd', false),
		iosSigningIdentity: tl.getInput('iosSigningIdentity', false)
	}
		
	return xcutils.determineIdentity(input)
		.then(function(result) {
			if(result.identity) {
				// TODO: Add CODE_SIGN_IDENTITY[iphoneos*]? 
				xcb.arg('CODE_SIGN_IDENTITY="' + result.identity + '"');
			} else {
				tl.debug('No explicit signing identity specified in task.')
			}
			if(result.keychain) {
				xcb.arg('OTHER_CODE_SIGN_FLAGS=--keychain="' + result.keychain + '"');
			}	
			deleteKeychain = result.deleteCommand;
		});
}

function iosProfile(code) {
	var input = {
		cwd: cwd,
		provProfileUuid:tl.getInput('provProfileUuid', false),
		provProfilePath:tl.getPathInput('provProfile', false),
		removeProfile:(tl.getInput('removeProfile', false)=="true")
	}
	
	return xcutils.determineProfile(input)
		.then(function(result) {
			if(result.uuid) {
				xcb.arg('PROVISIONING_PROFILE=' + result.uuid);								
			}
			deleteProvProfile = result.deleteCommand;
		});
}

function execBuild(code) {
	// Add optional additional args
	var args=tl.getDelimitedInput('args', ' ', false);			
	if(args) {
		xcb.arg(args);						
	}
	tl.debug('Complete build args: ');
	for(var arg in xcb.args) {
		tl.debug(xcb.args[arg]);
	}
	return xcb.exec();	
}
	
function packageApps(code) {
	if(tl.getInput('packageApp', true) == "true" && sdk != "iphonesimulator") {
		tl.debug('Packaging apps.');
		var promise = Q();
		tl.debug('out: ' + out);
		var outPath=path.join(out, 'build.sym');
		tl.debug('outPath: ' + outPath);
		appFolders = glob.sync(outPath + '/**/*.app')
		if(appFolders) {
			tl.debug(appFolders.length + ' apps found for packaging.');
			var xcrunPath = tl.which('xcrun', true);	
			for(var i=0; i<appFolders.length; i++) {
				promise = promise.then(function(code) { 
					var app = appFolders.pop();
					tl.debug('Packaging ' + app);
					var ipa = app.substring(0, app.length-3) + "ipa";
					var xcr = new tl.ToolRunner(xcrunPath);
					xcr.arg(['-sdk', sdk, 'PackageApplication', '-v', app, '-o', ipa]);
					return xcr.exec(); 
				});
			}
			return promise;				
		} else {
			tl.warning('No apps found to package in ' + outPath);
		}
	}
	return Q(0);
}

function removeExecOutputNoise(input) {
	var output = input + "";
	output = output.trim().replace(/[,\n\r\f\v]/gm,'');	
	return output;
}
