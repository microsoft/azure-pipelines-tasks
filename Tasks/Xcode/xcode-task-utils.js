/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/

var tl = require('vso-task-lib'),
	path = require('path'),
	fs = require('fs'),
	Q = require ('q'),
	exec = Q.nfbind(require('child_process').exec);

function determineIdentity(input) {
	tl.debug('Input to determineIdentity: ' + JSON.stringify(input));
	// Unlock keychain?
	var promise;
	if(input.unlockDefaultKeychain) {
		var unlockKeychain = new tl.ToolRunner(tl.which('bash', true));
		unlockKeychain.arg([path.resolve(__dirname,'unlockdefaultkeychain.sh'), input.defaultKeychainPassword]);	
		promise = unlockKeychain.exec();
	} else {
		promise = Q({});
	}

	// Add identity arg if specified
	// If p12 specified, create temporary keychain, import it, add to search path
	var p12 = input.p12;
	if(p12 && fs.lstatSync(p12).isFile() ) {
		p12 = path.resolve(input.cwd,p12);
		var keychain = path.join(input.cwd, '_tasktmp.keychain');
		var keychainPwd = Math.random();
		
		var createKeychain = new tl.ToolRunner(tl.which('bash', true));
		createKeychain.arg([path.resolve(__dirname,'createkeychain.sh'), keychain, keychainPwd, p12, input.p12pwd]);	

		// Configure keychain delete command
		var deleteCommand = new tl.ToolRunner('/usr/bin/security', true);
		deleteCommand.arg(['delete-keychain', keychain]);	

		promise = promise.then(function(code) {
			return createKeychain.exec();		
		});
		
		// Run command to set the identity based on the contents of the p12 if not specified in task config
		return promise.then(function() {
				return exec('/usr/bin/security find-identity -v -p codesigning "' + keychain + '" | grep -oE \'"(.+?)"\'');
			})
			.then(function(foundIdent) {
				foundIdent = removeExecOutputNoise(foundIdent)
				var ident;
				if(input.iosSigningIdentity) {
					tl.warning('Signing Identitiy specified along with P12 Certificate. Omit Signing Identity in task to ensure p12 value used.');
					ident = input.iosSigningIdentity;
				} else {
					ident = foundIdent;
				}
				return({
					identity: ident,
					foundIdentity: foundIdent,
					keychain: keychain,
					deleteCommand: deleteCommand
				});
			});	
	} else {
		tl.debug('p12 not specified in task.')
		return promise.then(function() {
			return { identity: input.iosSigningIdentity };
		});
	}	
}

function determineProfile(input) {
	tl.debug('Input to determineProfile: ' + JSON.stringify(input));
	if(input.provProfilePath) {
		var profilePath = path.resolve(input.cwd, input.provProfilePath);
		if(fs.existsSync(profilePath) && fs.lstatSync(profilePath).isFile()) { 
			tl.debug('Provisioning profile file found.')
			// Get UUID of provisioning profile
			return exec('/usr/libexec/PlistBuddy -c "Print UUID" /dev/stdin <<< $(/usr/bin/security cms -D -i "' + profilePath + '")')
				.then(function(foundUuid) {
					foundUuid = removeExecOutputNoise(foundUuid);
					tl.debug(profilePath + ' has UUID of ' + foundUuid);
					// Create delete profile call if flag specified
					var deleteCommand;
					if(input.removeProfile) {
						deleteCommand = new tl.ToolRunner(tl.which('rm'), true);
						deleteCommand.arg(['-f', process.env['HOME'] + '/Library/MobileDevice/Provisioning Profiles/' + foundUuid + '.mobileprovision']);
					}
					
					// return exec of copy command
					var userProfilesPath = path.join(process.env['HOME'], 'Library', 'MobileDevice', 'Provisioning Profiles'); 
					tl.mkdirP(userProfilesPath); // Path may not exist if Xcode has not been run yet.
					var copyProvProfile = new tl.ToolRunner(tl.which('cp'), true);
					copyProvProfile.arg(['-f', profilePath, path.join(userProfilesPath, foundUuid + '.mobileprovision')]);
					
					var uuid;
					if(input.provProfileUuid) {
						tl.warning('Profile UUID specified along with Profile Path. Omit Profile UUID in task to ensure the file\'s UUID value used.');
						uuid = input.provProfileUuid;
					} else {
						uuid = foundUuid;
					}
					
					return copyProvProfile.exec()
						.then(function() {
							return {
								uuid: uuid,
								foundUuid: foundUuid,
								deleteCommand: deleteCommand
							}
						});
				});
		} 	
	} 
	return Q({uuid: input.provProfileUuid});	
}
	
function removeExecOutputNoise(input) {
	var output = input + "";
	output = output.trim().replace(/[",\n\r\f\v]/gm,'');	
	return output;
}
	
module.exports = {
	determineIdentity: determineIdentity,
	determineProfile: determineProfile
}
