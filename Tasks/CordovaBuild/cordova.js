var tl = require('vso-task-lib'),
	path = require('path'),
	fs = require('fs'),
	glob = require('glob'),
	Q = require ('q'),
	ttb = require(path.join(__dirname,'taco-team-build')),
	exec = Q.nfbind(require('child_process').exec);

//** TODO: Update taco-team-build so it pulls the support plugin from npm since you can't access locally due to security - WHAT ABOUT < 5.0.0 NOW THAT THE REPO IS READ ONLY?

// Commands
var deleteKeychain = null, 
	deleteProvProfile = null;

// Globals
var origXcodeDeveloperDir, configuration, platform, out, buildArgs = [], iosXcConfig = '', cwd;

// Store original Xcode developer directory so we can restore it after build completes if its overridden
var origXcodeDeveloperDir = process.env['DEVELOPER_DIR'];

processInputs()														// Process inputs to task and create xcv, xcb
	.then(execBuild)												// Run main xcodebuild / xctool task
	.then(function() {
		// **TODO: Update taco-team-build to not create ipa if Cordova version already does it
		return ttb.packageProject(platform);						// Package apps if configured
	})												
	.then(function(code) {											// When done, delete the temporary keychain if it exists
		if(deleteKeychain) {
			return deleteKeychain.exec();
		} else {
			return 0;
		}
	})
	.then(function(code) {											// Next delete the provisioning profile if says this should happen		
		if(deleteProvProfile) {
			return deleteProvProfile.exec();
		} else {
			return 0;
		}
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
	
	if(tl.getInput('targetEmulator', false) == "true") {
		buildArgs.push('--emulator');
	} else {
		buildArgs.push('--device')		
	}
	
	return processCert().then(processProfile);
}

function processCert(code) {
	
	// Add identity arg if specified
	var identity = tl.getInput('identity', false);
	if(identity) {
		iosXcConfig += 'CODE_SIGN_IDENTITY="' + tl.getInput('identity', true) + '"\n';
		iosXcConfig += 'CODE_SIGN_IDENTITY[sdk=iphoneos*]="' + tl.getInput('identity', true) + '"\n';
	} else {
		tl.debug('No explicit signing identity specified in task.')
	}
	// If p12 specified, create temporary keychain, import it, add to search path
	var p12 = tl.getPathInput('p12', false, false);
	if(p12 && fs.lstatSync(p12).isFile() ) {
		p12 = path.resolve(cwd,p12);
		var p12pwd = tl.getInput('p12pwd', true);
		var keychain = path.join(cwd, '_tasktmp.keychain');
		var keychainPwd = Math.random();
	
		// Configure keychain delete command
		deleteKeychain = new tl.ToolRunner('/usr/bin/security', true);
		deleteKeychain.arg(['delete-keychain', keychain]);	
		
		var createKeychain = new tl.ToolRunner(tl.which('bash', true));
		createKeychain.arg([path.resolve(__dirname,'createkeychain.sh'), keychain, keychainPwd, p12, p12pwd]);	
		var promise = createKeychain.exec();
		
		iosXcConfig += 'OTHER_CODE_SIGN_FLAGS="--keychain=' + keychain + '"\n';
		
		// Run command to set the identity based on the contents of the p12 if not specified in task config
		if(!identity) {
			promise = promise.then(function() {
					return exec('/usr/bin/security find-identity -v -p codesigning "' + keychain + '" | grep -oE \'"(.+?)"\'');
				})
				.then(function(foundIdent) {
					foundIdent = removeExecOutputNoise(foundIdent);
					tl.debug('Using signing identity in p12: (' + foundIdent + ')');
					iosXcConfig += 'CODE_SIGN_IDENTITY="' + foundIdent + '"\n';
					iosXcConfig += 'CODE_SIGN_IDENTITY[sdk=iphoneos*]="' + foundIdent + '"\n';
				});	
		} else {
			tl.warning('Signing Identitiy specified along with P12 Certificate P12. Omit Signing Identity in task to ensure p12 value used.')
		}
		return promise;		
	} else {
		tl.debug('p12 not specified in task.')
		return Q(0);
	}
}

function processProfile(code) {
	var provProfileUuid = tl.getPathInput('provProfileUuid', false);
	if(provProfileUuid) {
		iosXcConfig += 'PROVISIONING_PROFILE=' + provProfileUuid + '\n';	
	}
	var profilePath = path.resolve(cwd, tl.getPathInput('provProfile', false));
	if(fs.existsSync(profilePath) && fs.lstatSync(profilePath).isFile()) { 
		tl.debug('Provisioning profile file found.')
		// Get UUID of provisioning profile
		return exec('/usr/libexec/PlistBuddy -c "Print UUID" /dev/stdin <<< $(/usr/bin/security cms -D -i "' + profilePath + '")')
			.then(function(uuid) {
				uuid = removeExecOutputNoise(uuid);
				tl.debug(profilePath + ' has UUID of ' + uuid);
				if(!provProfileUuid) {
					// Add UUID to xcodebuild args
					iosXcConfig += 'PROVISIONING_PROFILE=' + uuid + '\n';								
				} else {
					tl.warning('Provisioning Profile UUID specified along with Provisioning Profile File. Omit Provisioning Profile UUID in task to ensure file value used.')			
				}
				// Create delete profile call if flag specified
				if(tl.getInput('removeProfile', true) == "true") {
					deleteProvProfile = new tl.ToolRunner(tl.which('rm'), true);
					deleteProvProfile.arg(['-f', process.env['HOME'] + '/Library/MobileDevice/Provisioning Profiles/' + uuid + '.mobileprovision']);
				}
				// return exec of copy command
				var copyProvProfile = new tl.ToolRunner(tl.which('cp'), true);
				copyProvProfile.arg(['-f', profilePath, process.env['HOME'] + '/Library/MobileDevice/Provisioning Profiles/' + uuid + '.mobileprovision']);
				return copyProvProfile.exec();
			}); 
	} else {
		return Q(0);
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
	
function removeExecOutputNoise(input) {
	var output = input + "";
	output = output.trim().replace(/[,\n\r\f\v]/gm,'');	
	return output;
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