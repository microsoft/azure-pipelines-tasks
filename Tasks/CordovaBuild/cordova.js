/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/

var tl = require('vso-task-lib'),
	path = require('path'),
	fs = require('fs'),
	Q = require ('q'),
	xcutils = require('xcode-task-utils'),
	ttb = require('taco-team-build');

// Commands
var deleteKeychain = null, 
	deleteProvProfile = null;

// Globals
var origXcodeDeveloperDir, configuration, platform, out, buildArgs = [], iosXcConfig = '', antProperties = {}, cwd, targetEmulator;

// Store original Xcode developer directory so we can restore it after build completes if its overridden
var origXcodeDeveloperDir = process.env['DEVELOPER_DIR'];

processInputs()														// Process inputs to task and create xcv, xcb
	.then(execBuild)												// Run main xcodebuild / xctool task
	.then(function() {
		return targetEmulator ? 0 : ttb.packageProject(platform);	// Package apps if configured
	})												
	.then(function(code) {											// When done, delete the temporary keychain if it exists
		return deleteKeychain ? deleteKeychain.exec() : 0;
	})
	.then(function(code) {											// Next delete the provisioning profile if says this should happen		
		return deleteProvProfile ? deleteProvProfile.exec() : 0;
	})
	.then(function(code) {											// On success, exit
		process.env['DEVELOPER_DIR'] = origXcodeDeveloperDir;
		tl.exit(code);
	})
	.fail(function(err) {
		process.env['DEVELOPER_DIR'] = origXcodeDeveloperDir;
		console.error(err.message);
		tl.debug('taskRunner fail');
		if(deleteKeychain) {										// Delete keychain if created - catch all to avoid problems
			deleteKeychain.exec()
				.then(function(code) {
					tl.exit(1);
				});
		} else {
			tl.exit(1);
		}
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
		
	configuration = tl.getInput('configuration', true).toLowerCase();
	buildArgs.push('--' + configuration);		
	
	var archs = tl.getInput('archs', false);
	if(archs) {
		buildArgs.push('--archs="' + archs + '"')
	}

	targetEmulator = (tl.getInput('targetEmulator', false) == "true");
	if(targetEmulator) {
		buildArgs.push('--emulator');
	} else {
		buildArgs.push('--device')		
	}

	platform = tl.getInput('platform', true);
	switch(platform) {
		case 'android':
			processAndroidInputs();
			return Q(0);
		case 'ios':
			return iosIdentity().then(iosProfile);
		default: 
			return Q(0);
	}
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
				iosXcConfig += 'CODE_SIGN_IDENTITY=' + result.identity + '\n';
				iosXcConfig += 'CODE_SIGN_IDENTITY[sdk=iphoneos*]=' + result.identity + '\n';
			} else {
				tl.debug('No explicit signing identity specified in task.')
			}
			if(result.keychain) {
				iosXcConfig += 'OTHER_CODE_SIGN_FLAGS="--keychain=' + result.keychain + '\n';
			}	
			deleteKeychain = result.deleteCommand;
		});
}

function iosProfile(code) {
	var input = {
		cwd: cwd,
		provProfileUuid:tl.getInput('provProfileUuid', false),
		provProfilePath:tl.getPathInput('provProfilePath', false),
		removeProfile:(tl.getInput('removeProfile', false)=="true")
	}
	
	return xcutils.determineProfile(input)
		.then(function(result) {
		if(result.uuid) {
			iosXcConfig += 'PROVISIONING_PROFILE=' + result.uuid + '\n';	
		}
		deleteProvProfile = result.deleteCommand;
	});
}

function processAndroidInputs() {
	if(tl.getInput('forceAnt', false) == "true") {
		buildArgs.push('--ant');
	} else {
		buildArgs.push('--gradleArg=--no-daemon');  // Gradle daemon will hang the agent - need to turn it off			
	}

	// Pass in args for Android 4.0.0+, modify ant.properties before_compile for < 4.0.0 (event handler added at exec time)
	// Override gradle args
	var keystoreFile = tl.getPathInput('keystoreFile', false);
	if(fs.lstatSync(keystoreFile).isFile()) {
		buildArgs.push('--keystore="' + keystoreFile + '"');
		antProperties['key.store'] = keystoreFile;
		antProperties.override = true;		
	}
	
	var keystorePass = tl.getInput('keystorePass', false);
	if(keystorePass) {
		buildArgs.push('--storePassword="' + keystorePass + '"');
		antProperties['key.store.password'] = keystorePass;		
		antProperties.override = true;		
	}
	
	var keystoreAlias = tl.getInput('keystoreAlias', false);
	if(keystoreAlias) {
		buildArgs.push('--alias="' + keystoreAlias + '"');
		antProperties['key.alias'] = keystoreAlias;		
		antProperties.override = true;		
	}

	var keyPass = tl.getInput('keyPass', false);
	if(keyPass) {
		buildArgs.push('--password="' + keyPass + '"');
		antProperties['key.alias.password'] = keyPass;		
		antProperties.override = true;		
	}
}


function execBuild(code) {
	var cordovaConfig = {
		projectPath: cwd
	}

	// Add optional additional args
	var args=tl.getDelimitedInput('args', ' ', false);			
	if(args) {
		args.forEach(function(arg) {
			arg = arg.replace('-- --', '--');  // Cut out double-double dash for platform specific args... not needed here	
			buildArgs.push(arg);	
		});
	}
			
	var version = tl.getInput('cordovaVersion', false);
	if(version) {
		cordovaConfig.cordovaVersion = version;
	}
			
	var updateXcconfig = (iosXcConfig != '')
	return ttb.setupCordova(cordovaConfig)
		.then(function(cordova) {
			// Add update Xcconfig hook if needed
			if(updateXcconfig) {
				tl.debug('Adding Xcconfig update hook')
				cordova.on('before_compile', writeVsoXcconfig)
			}
			if(antProperties.override) {
				tl.debug('Adding ant.properties update hook')
				cordova.on('before_compile', writeAntProperties)				
			}
			return ttb.buildProject(platform,buildArgs)
				.fin(function() {
					// Remove xcconfig hook
					if(updateXcconfig) {				
						tl.debug('Removing Xcconfig update hook')
						cordova.off('before_compile', writeVsoXcconfig)
					}
					if(antProperties.override) {
						tl.debug('Removing ant.properties update hook')
						cordova.on('before_compile', writeAntProperties)				
					}
				});
		});
}

function writeVsoXcconfig(data) {
	tl.debug('before_prepare fired hook  writeVsoXcconfig');
	var includeText = '\n#include "build-vso.xcconfig"';
	var buildVsoXcconfig = path.join(cwd, 'platforms', 'ios', 'cordova', 'build-vso.xcconfig');
	var buildXccondig;
	var debugConfig = path.join(cwd, 'platforms', 'ios', 'cordova', 'build-debug.xcconfig');
	if(fs.existsSync(debugConfig)) {
		// Need to update build-debug.xcconfig and build-release.xcconfig as needed
		buildXccondig = [debugConfig, path.join(cwd, 'platforms', 'ios', 'cordova', 'build-release.xcconfig')];
	} else {
		buildXccondig = [path.join(cwd, 'platforms', 'ios', 'cordova', 'build.xcconfig')];
	}
	tl.debug('xcconfig files to add include to: ' + JSON.stringify(buildXccondig));
	// Append build-vso.xcconfig include if needed
	buildXccondig.forEach(function(xcconfig) {
		var origContents = fs.readFileSync(xcconfig) + '';
		if(origContents.indexOf(includeText) < 0) {
			fs.appendFileSync(xcconfig, includeText);
			tl.debug('Appended build-vso.xcconfig include to ' + xcconfig);
		} else {
			tl.debug('build-vso.xcconfig include already present in ' + xcconfig);			
		}		
	});
	// Delete existing build-vso.xcconfig if present
	if(fs.existsSync(buildVsoXcconfig)) {
		fs.unlinkSync(buildVsoXcconfig);
	}
	// Write out build-vso.xcconfig
	tl.debug('Writing config to ' + buildVsoXcconfig + '. Contents:\n' + iosXcConfig);
	fs.writeFileSync(buildVsoXcconfig, iosXcConfig);
}

function writeAntProperties(data) {
	tl.debug('before_prepare fired hook writeAntProperties');
	var antFile = path.join(cwd, 'platforms', 'android', 'ant.propeties');
	var contents = '\n';
	for(var prop in antProperties) {
		if(prop != 'override') {
			contents += prop + '="' + antProperties[prop] + '"\n'; 
		}
	}
	if(fs.existsSync(antFile)) {
		var origContents = fs.readFileSync(antFile);
		for(var prop in antProperties) {
			origContents=origContents.replace(prop + '[.*?]\n','');
		}
		contents = origContents + contents;
		fs.unlinkSync(antFile);
	}
	tl.debug('Writing config to ' + antFile + '. Contents:');
	tl.debug(contents);
	fs.writeFileSync(antFile, contents);
}