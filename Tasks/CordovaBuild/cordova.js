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
var origXcodeDeveloperDir, configuration, platform, out, buildArgs = [], iosXcConfig = '', cwd, targetEmulator;

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
	
	platform = tl.getInput('platform', true);
	if(platform == 'android') {
		buildArgs.push('--gradleArg=--no-daemon');  // Gradle daemon will hang the agent - need to turn it off	
	}

		
	configuration = tl.getInput('configuration', true).toLowerCase();
	buildArgs.push('--' + configuration);		
	
	var archs = tl.getInput('archs', false);
	if(archs) {
		buildArgs.push('--archs="' + archs + '"')
	}

	if(tl.getInput('forceAnt', false) == "true") {
		buildArgs.push('--ant');
	}
	
	targetEmulator = (tl.getInput('targetEmulator', false) == "true");
	if(targetEmulator) {
		buildArgs.push('--emulator');
	} else {
		buildArgs.push('--device')		
	}
	
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
		
	return xcutils.determineIdentity(input, function(identity, keychain, deleteCommand) {
		if(identity) {
			iosXcConfig += 'CODE_SIGN_IDENTITY="' + identity + '"\n';
			iosXcConfig += 'CODE_SIGN_IDENTITY[sdk=iphoneos*]="' + identity + '"\n';
		} else {
			tl.debug('No explicit signing identity specified in task.')
		}
		if(keychain) {
			iosXcConfig += 'OTHER_CODE_SIGN_FLAGS="--keychain=' + keychain + '"\n';
		}	
		deleteKeychain = deleteCommand;
	});
}

function iosProfile(code) {
	var input = {
		cwd: cwd,
		provProfileUuid:tl.getInput('provProfileUuid', false),
		provProfilePath:tl.getPathInput('provProfilePath', false),
		removeProfile:(tl.getInput('removeProfile', false)=="true")
	}
	
	return xcutils.determineProfile(input, function(uuid, deleteCommand) {
		if(uuid) {
			iosXcConfig += 'PROVISIONING_PROFILE=' + uuid + '\n';	
		}
		deleteProvProfile = deleteCommand;
	});
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
			return ttb.buildProject(platform,buildArgs)
				.fin(function() {
					// Remove xcconfig hook
					if(updateXcconfig) {				
						tl.debug('Removing Xcconfig update hook')
						cordova.off('before_compile', writeVsoXcconfig)
					}
				});
		});
}

function writeVsoXcconfig(data) {
	var buildVsoXcconfig = path.join(cwd, 'platforms', 'ios', 'cordova', 'build-vso.xcconfig');
	// *** TODO: Check these files for the include instead since res/native can wipe them out!
	if(!fs.exists(buildVsoXcconfig)) {
		var debugConfig = path.join(cwd, 'platforms', 'ios', 'cordova', 'build-debug.xcconfig');
		if(fs.exists(debugConfig)) {
			// Update release and debug xcconfig files to have VSO config file in them
			fs.appendFileSync(debugConfig, '\n#include "build-vso.xcconfig"');
			fs.appendFileSync(path.join(cwd, 'platforms', 'ios', 'cordova', 'build-release.xcconfig'), '\n#include "build-vso.xcconfig"');
		} else {
			// Really old Cordova version - add it to main build.xcconfig
			fs.appendFileSync(path.join(cwd, 'platforms', 'ios', 'cordova', 'build.xcconfig'), '\n#include "build-vso.xcconfig"');				
		}
	} else {
		fs.unlinkSync(buildVsoXcconfig);
	}
	// Write out build-vso.xcconfig
	tl.debug('Writing config to ' + buildVsoXcconfig + '. Contents:\n' + iosXcConfig);
	fs.writeFileSync(buildVsoXcconfig, iosXcConfig);
}