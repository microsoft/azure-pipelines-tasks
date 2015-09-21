var tl = require('vso-task-lib'),
	path = require('path'),
	fs = require('fs'),
	Q = require ('q'),
	exec = Q.nfbind(require('child_process').exec);

function determineIdentity(input, callback) {
	// Unlock keychain?
	var promise;
	if(input.unlockDefaultKeychain) {
		var unlockKeychain = new tl.ToolRunner(tl.which('bash', true));
		unlockKeychain.arg([path.resolve(__dirname,'unlockdefaultkeychain.sh'), input.defaultKeychainPassword]);	
		promise = unlockKeychain.exec();
	} else {
		promise = Q(0);
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
		var deleteKeychain = new tl.ToolRunner('/usr/bin/security', true);
		deleteKeychain.arg(['delete-keychain', keychain]);	

		promise = promise.then(function(code) {
			return createKeychain.exec();		
		});
		
		// Run command to set the identity based on the contents of the p12 if not specified in task config
		if(!input.iosSigningIdentity) {
			promise = promise.then(function() {
					return exec('/usr/bin/security find-identity -v -p codesigning "' + keychain + '" | grep -oE \'"(.+?)"\'');
				})
				.then(function(foundIdent) {
					foundIdent = removeExecOutputNoise(foundIdent);
					callback(foundIdent, keychain, deleteKeychain);
				});	
		} else {
			tl.warning('Signing Identitiy specified along with P12 Certificate P12. Omit Signing Identity in task to ensure p12 value used.')
			callback(input.iosSigningIdentity, keychain, deleteKeychain);
		}
		return promise;		
	} else {
		callback(input.iosSigningIdentity, undefined, undefined);
		tl.debug('p12 not specified in task.')
		return Q(0);
	}		
}

function determineProfile(input, callback) {
	
	if(input.provProfileUuid) {
		callback(input.provProfileUuid, undefined);
		return Q(0);
	}
	if(input.provProfilePath) {
		var profilePath = path.resolve(input.cwd, input.provProfilePath);
		if(fs.existsSync(profilePath) && fs.lstatSync(profilePath).isFile()) { 
			tl.debug('Provisioning profile file found.')
			// Get UUID of provisioning profile
			return exec('/usr/libexec/PlistBuddy -c "Print UUID" /dev/stdin <<< $(/usr/bin/security cms -D -i "' + profilePath + '")')
				.then(function(uuid) {
					uuid = removeExecOutputNoise(uuid);
					tl.debug(profilePath + ' has UUID of ' + uuid);
					var deleteProvProfile;
					// Create delete profile call if flag specified
					if(input.removeProfile) {
						deleteProvProfile = new tl.ToolRunner(tl.which('rm'), true);
						deleteProvProfile.arg(['-f', process.env['HOME'] + '/Library/MobileDevice/Provisioning Profiles/' + uuid + '.mobileprovision']);
					}
					
					// return exec of copy command
					var copyProvProfile = new tl.ToolRunner(tl.which('cp'), true);
					copyProvProfile.arg(['-f', profilePath, process.env['HOME'] + '/Library/MobileDevice/Provisioning Profiles/' + uuid + '.mobileprovision']);
					
					callback(uuid, deleteProvProfile);
					return copyProvProfile.exec();
				});
		} 	
	} 
	return Q(0);
}
	
function removeExecOutputNoise(input) {
	var output = input + "";
	output = output.trim().replace(/[,\n\r\f\v]/gm,'');	
	return output;
}
	
module.exports = {
	determineIdentity: determineIdentity,
	determineProfile: determineProfile
}
