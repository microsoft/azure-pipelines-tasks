import fs = require('fs');
import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');

var iosSecurityToolPath = '/usr/bin/security';
var userProvisioningProfilesPath = path.join(process.env['HOME'], 'Library', 'MobileDevice', 'Provisioning Profiles');

/**
 * Creates a temporary keychain and installs the P12 cert in the temporary keychain
 * @param keychainPath, the path to the keychain file
 * @param keychainPwd, the password to use for unlocking the keychain
 * @param p12CertPath, the P12 cert to be installed in the keychain
 * @param p12Pwd, the password for the P12 cert
 */
export async function installCertInTemporaryKeyChain(keychainPath : string, keychainPwd: string, p12CertPath : string, p12Pwd: string) {

    //delete keychain if exists
    await deleteKeychain(keychainPath);

    //create keychain
    var createKeychainCommand =  tl.createToolRunner(tl.which(iosSecurityToolPath, true));
    createKeychainCommand.arg('create-keychain');
    createKeychainCommand.arg('-p');
    createKeychainCommand.arg(keychainPwd);
    createKeychainCommand.pathArg(keychainPath);
    await createKeychainCommand.exec();

    //update keychain settings
    var keychainSettingsCommand = tl.createToolRunner(tl.which(iosSecurityToolPath, true));
    keychainSettingsCommand.arg('set-keychain-settings');
    keychainSettingsCommand.arg('-lut');
    keychainSettingsCommand.arg('7200');
    keychainSettingsCommand.pathArg(keychainPath);
    await keychainSettingsCommand.exec();

    //unlock keychain
    await unlockKeychain(keychainPath, keychainPwd);

    //import p12 cert into the keychain
    var importP12Command = tl.createToolRunner(tl.which(iosSecurityToolPath, true));
    importP12Command.arg('import');
    importP12Command.pathArg(p12CertPath);
    importP12Command.arg('-P');
    importP12Command.arg(p12Pwd);
    importP12Command.arg(['-A', '-t', 'cert', '-f', 'pkcs12', '-k']);
    importP12Command.arg(keychainPath);
    await importP12Command.exec();
}

/**
 * Finds an iOS codesigning identity in the specified keychain
 * @param keychainPath
 * @returns {string} signing identity found
 */
export async function findSigningIdentity(keychainPath: string) {
    var signIdentity : string;
    var findIdentity = tl.createToolRunner(tl.which(iosSecurityToolPath, true));
    findIdentity.arg(['find-identity', '-v', '-p', 'codesigning']);
    findIdentity.pathArg(keychainPath);
    findIdentity.on('stdout', function (data) {
        if (data) {
            var matches = data.toString().trim().match(/\((.+)\)/g);
            tl.debug('signing identity data = ' + matches);
            if(matches) {
                signIdentity = matches[0];
            }
        }
    })

    await findIdentity.exec();
    if(signIdentity) {
        tl.debug('findSigningIdentity = ' + signIdentity);
        return signIdentity;
    } else {
        throw 'Failed to find iOS signing identity. Verify the signing and provisioning information provided.';
    }
}

/**
 * Find the UUID of the provisioning profile and install the profile
 * @param provProfilePath
 * @returns {string} UUID
 */
export async function getProvisioningProfileUUID(provProfilePath: string) {

    //find the provisioning profile UUID
    var provProfileDetails;
    var getProvProfileDetails = tl.createToolRunner(tl.which(iosSecurityToolPath, true));
    getProvProfileDetails.arg(['cms', '-D', '-i']);
    getProvProfileDetails.pathArg(provProfilePath);
    getProvProfileDetails.on('stdout', function(data) {
        if(data) {
            if(provProfileDetails) {
                provProfileDetails = provProfileDetails.concat(data.toString().trim().replace(/[,\n\r\f\v]/gm, ''));
            } else {
                provProfileDetails = data.toString().trim().replace(/[,\n\r\f\v]/gm, '');
            }
        }
    })
    await getProvProfileDetails.exec();

    if(provProfileDetails) {
        //write the provisioning profile to a plist
        var tmpPlist = '_xcodetasktmp.plist';
        fs.writeFileSync(tmpPlist, provProfileDetails);
    } else {
        throw 'Failed to find the details for provisioning profile: ' + provProfilePath;
    }

    var provProfileUUID : string;

    //use PlistBuddy to figure out the UUID
    var plist = tl.which('/usr/libexec/PlistBuddy', true);
    var plistTool = tl.createToolRunner(plist);
    plistTool.arg(['-c', 'Print UUID']);
    plistTool.pathArg(tmpPlist);
    plistTool.on('stdout', function (data) {
        if (data) {
            provProfileUUID = data.toString();
        }
    })
    await plistTool.exec();

    //delete the temporary plist file
    var deletePlistCommand = tl.createToolRunner(tl.which('rm', true));
    deletePlistCommand.arg('-f');
    deletePlistCommand.pathArg(tmpPlist);
    await deletePlistCommand.exec();

    if(provProfileUUID) {
        //copy the provisioning profile file to ~/Library/MobileDevice/Provisioning Profiles
        tl.mkdirP(userProvisioningProfilesPath); // Path may not exist if Xcode has not been run yet.
        var pathToProvProfile = getProvisioningProfilePath(provProfileUUID);
        var copyProvProfile = tl.createToolRunner(tl.which('cp', true));
        copyProvProfile.arg('-f');
        copyProvProfile.pathArg(provProfilePath); //source
        copyProvProfile.pathArg(pathToProvProfile); //dest
        await copyProvProfile.exec();

        return provProfileUUID;
    } else {
        throw 'Failed to find provisioning profile UUID for provisioning profile: ' + provProfilePath;
    }
}

/**
 * Delete specified iOS keychain
 * @param keychainPath
 */
export async function deleteKeychain(keychainPath: string) {
    if (fs.existsSync(keychainPath)) {
        var deleteKeyChainCommand = tl.createToolRunner(tl.which(iosSecurityToolPath, true));
        deleteKeyChainCommand.arg('delete-keychain');
        deleteKeyChainCommand.pathArg(keychainPath);
        await deleteKeyChainCommand.exec();
    }
}

/**
 * Unlock specified iOS keychain
 * @param keychainPath
 * @param keychainPwd
 */
export async function unlockKeychain(keychainPath: string, keychainPwd: string) {
    //unlock the keychain
    var unlockCommand = tl.createToolRunner(tl.which(iosSecurityToolPath, true));
    unlockCommand.arg('unlock-keychain');
    unlockCommand.arg('-p');
    unlockCommand.arg(keychainPwd.toString());
    unlockCommand.pathArg(keychainPath);
    await unlockCommand.exec();
}

/**
 * Delete provisioning profile with specified UUID in the user's profiles directory
 * @param uuid
 */
export async function deleteProvisioningProfile(uuid: string) {
    var provProfilePath = getProvisioningProfilePath(uuid);
    if(fs.exists(provProfilePath)) {
        var deleteProfileCommand = tl.createToolRunner(tl.which('rm', true));
        deleteProfileCommand.arg('-f');
        deleteProfileCommand.pathArg(provProfilePath);
        await deleteProfileCommand.exec();
    }
}

function getProvisioningProfilePath(uuid: string) : string {
    return path.join(userProvisioningProfilesPath, uuid.trim().concat('.mobileprovision'));
}
