var tl = require('vso-task-lib'),
	path = require('path'),
	fs = require('fs'),
	glob = require('glob'),
	Q = require ('q'),
	exec = Q.nfbind(require('child_process').exec);

// Commands
var xcv = null, 
	xcb = null, 
	xcr = null,
	deleteKeychain = null, 
	deleteProvProfile = null;

// Globals
var buildSourceDirectory, origXcodeDeveloperDir, out, sdk, appFolders;

// Store original Xcode developer directory so we can restore it after build completes if its overridden
var origXcodeDeveloperDir = process.env['DEVELOPER_DIR'];

processInputs();													// Process inputs to task and create xcv, xcb
xcv.exec()															// Print version of xcodebuild / xctool
	.then(processCert)												// Process any p12 files configured
	.then(processProfile)											// Processing any provisioning profiles
	.then(execBuild)												// Run main xcodebuild / xctool task
	.then(packageApps)												// Package apps if configured
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
	buildSourceDirectory = tl.getVariable('build.sourceDirectory') || tl.getVariable('build.sourcesDirectory');
	out = path.resolve(buildSourceDirectory, tl.getInput('outputPattern', true));

	//Process working directory
	var cwd = tl.getInput('cwd') || buildSourceDirectory;
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
	// Xcode build call
	if(tl.getInput("unlockDefaultKeychain")=="true") {
		// May be able to refactor this so that the unlock is called as a separate step rather than during the xcodebuild call via bash - Saw inconsistant results so more research required to determine if the child process inherits the unlock.
		xcb = new tl.ToolRunner(tl.which('bash')); 
		xcb.arg(['-l','-c','/usr/bin/security unlock-keychain -p "' + tl.getInput('defaultKeychainPassword',true) + '" $(security default-keychain | grep -oE \'"(.+?)"\' | grep -oE \'[^"]*[\\n]\'); $0 "$@"', tool]);
	} else {
		xcb = new tl.ToolRunner(tool);
	}
		
	// Add required flags
	sdk = tl.getInput('sdk', true);
	xcb.arg('-sdk');
	xcb.arg(sdk);
	xcb.arg('-configuration');
	xcb.arg(tl.getInput('configuration', true));
	// Args: Add optional workspace flag
	var workspace = tl.getPathInput('xcWorkspacePath', false, false)
	if(workspace) {
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
}

function processCert(code) {
	// Add identity arg if specified
	var identity = tl.getInput('identity', false);
	if(identity) {
		xcb.arg('CODE_SIGN_IDENTITY="' + tl.getInput('identity', true) + '"');
	} else {
		tl.debug('No explicit signing identity specified in task.')
	}
	// If p12 specified, create temporary keychain, import it, add to search path
	var p12 = tl.getPathInput('p12', false, false);
	if(p12 && fs.lstatSync(p12).isFile() ) {
		p12 = path.resolve(buildSourceDirectory,p12);
		var p12pwd = tl.getInput('p12pwd', true);
		var keychain = path.join(buildSourceDirectory, '_tasktmp.keychain');
		var keychainPwd = Math.random();
	
		// Configure keychain delete command
		deleteKeychain = new tl.ToolRunner('/usr/bin/security', true);
		deleteKeychain.arg(['delete-keychain', keychain]);	
		
		var createKeychain = new tl.ToolRunner(tl.which('bash', true));
		createKeychain.arg([path.resolve(__dirname,'createkeychain.sh'), keychain, keychainPwd, p12, p12pwd]);	
		var promise = createKeychain.exec();
		
		xcb.arg('OTHER_CODE_SIGN_FLAGS="--keychain=' + keychain + '"');
		
		// Run command to set the identity based on the contents of the p12 if not specified in task config
		if(!identity) {
			promise = promise.then(function() {
					return exec('/usr/bin/security find-identity -v -p codesigning "' + keychain + '" | grep -oE \'"(.+?)"\'');
				})
				.then(function(foundIdent) {
					foundIdent = removeExecOutputNoise(foundIdent);
					tl.debug('Using signing identity in p12: (' + foundIdent + ')');
					xcb.arg("CODE_SIGN_IDENTITY=" + foundIdent);
				});	
		} else {
			tl.warning('Signing Identitiy specified along with P12 Certificate P12. Omit Signing Identity in task to ensure p12 value used.')
		}
		return promise;		
	} else {
		tl.debug('p12 not specified in task.')
		return 0;
	}
}

function processProfile(code) {
	var provProfileUuid = tl.getPathInput('provProfileUuid', false);
	if(provProfileUuid) {
		xcb.arg('PROVISIONING_PROFILE=' + provProfileUuid);	
	}
	var profilePath = path.resolve(buildSourceDirectory, tl.getPathInput('provProfile', false));
	if(fs.existsSync(profilePath) && fs.lstatSync(profilePath).isFile()) { 
		tl.debug('Provisioning profile file found.')
		// Get UUID of provisioning profile
		return exec('/usr/libexec/PlistBuddy -c "Print UUID" /dev/stdin <<< $(/usr/bin/security cms -D -i "' + profilePath + '")')
			.then(function(uuid) {
				uuid = removeExecOutputNoise(uuid);
				tl.debug(profilePath + ' has UUID of ' + uuid);
				if(!provProfileUuid) {
					// Add UUID to xcodebuild args
					xcb.arg('PROVISIONING_PROFILE=' + uuid);								
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
		return 0;
	}
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
	return 0;
}

function removeExecOutputNoise(input) {
	var output = input + "";
	output = output.trim().replace(/[,\n\r\f\v]/gm,'');	
	return output;
}
