import fs = require('fs');
import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import {ToolRunner} from 'vsts-task-lib/toolrunner';

var userProvisioningProfilesPath = path.join(tl.getVariable('HOME'), 'Library', 'MobileDevice', 'Provisioning Profiles');

/**
 * Creates a temporary keychain and installs the P12 cert in the temporary keychain
 * @param keychainPath, the path to the keychain file
 * @param keychainPwd, the password to use for unlocking the keychain
 * @param p12CertPath, the P12 cert to be installed in the keychain
 * @param p12Pwd, the password for the P12 cert
 */
export async function installCertInTemporaryKeychain(keychainPath : string, keychainPwd: string, p12CertPath : string, p12Pwd: string) {
    //delete keychain if exists
    await deleteKeychain(keychainPath);

    //create keychain
    var createKeychainCommand : ToolRunner =  tl.createToolRunner(tl.which('security', true));
    createKeychainCommand.arg(['create-keychain', '-p', keychainPwd]);
    createKeychainCommand.pathArg(keychainPath);
    await createKeychainCommand.exec();

    //update keychain settings
    var keychainSettingsCommand : ToolRunner = tl.createToolRunner(tl.which('security', true));
    keychainSettingsCommand.arg(['set-keychain-settings', '-lut', '7200']);
    keychainSettingsCommand.pathArg(keychainPath);
    await keychainSettingsCommand.exec();

    //unlock keychain
    await unlockKeychain(keychainPath, keychainPwd);

    //import p12 cert into the keychain
    var importP12Command : ToolRunner = tl.createToolRunner(tl.which('security', true));
    importP12Command.arg('import');
    importP12Command.pathArg(p12CertPath);
    importP12Command.arg(['-P', p12Pwd, '-A', '-t', 'cert', '-f', 'pkcs12', '-k']);
    importP12Command.pathArg(keychainPath);
    await importP12Command.exec();

    //list the keychain
    var listCommand : ToolRunner = tl.createToolRunner(tl.which('security', true));
    listCommand.arg(['list-keychain', '-d', 'user', '-s',  keychainPath]);
    await listCommand.exec();
}

/**
 * Finds an iOS codesigning identity in the specified keychain
 * @param keychainPath
 * @returns {string} signing identity found
 */
export async function findSigningIdentity(keychainPath: string) {
    var signIdentity : string;
    var findIdentityCmd : ToolRunner = tl.createToolRunner(tl.which('security', true));
    findIdentityCmd.arg(['find-identity', '-v', '-p', 'codesigning']);
    findIdentityCmd.pathArg(keychainPath);
    findIdentityCmd.on('stdout', function (data) {
        if (data) {
            var matches = data.toString().trim().match(/"(.+)"/g);
            tl.debug('signing identity data = ' + matches);
            if(matches && matches[0]) {
                signIdentity = matches[0].replace(/"/gm, '');
                tl.debug('signing identity data trimmed = ' + signIdentity);
            }
        }
    })

    await findIdentityCmd.exec();
    if(signIdentity) {
        tl.debug('findSigningIdentity = ' + signIdentity);
        return signIdentity;
    } else {
        throw tl.loc('SignIdNotFound');
    }
}

/**
 * Find the UUID of the provisioning profile and install the profile
 * @param provProfilePath
 * @returns {string} UUID
 */
export async function getProvisioningProfileUUID(provProfilePath: string) {

    //find the provisioning profile UUID
    var provProfileDetails : string;
    var getProvProfileDetailsCmd : ToolRunner = tl.createToolRunner(tl.which('security', true));
    getProvProfileDetailsCmd.arg(['cms', '-D', '-i']);
    getProvProfileDetailsCmd.pathArg(provProfilePath);
    getProvProfileDetailsCmd.on('stdout', function(data) {
        if(data) {
            if(provProfileDetails) {
                provProfileDetails = provProfileDetails.concat(data.toString().trim().replace(/[,\n\r\f\v]/gm, ''));
            } else {
                provProfileDetails = data.toString().trim().replace(/[,\n\r\f\v]/gm, '');
            }
        }
    })
    await getProvProfileDetailsCmd.exec();

    if(provProfileDetails) {
        //write the provisioning profile to a plist
        var tmpPlist = '_xcodetasktmp.plist';
        fs.writeFileSync(tmpPlist, provProfileDetails);
    } else {
        throw tl.loc('ProvProfileDetailsNotFound', provProfilePath);
    }

    //use PlistBuddy to figure out the UUID
    var provProfileUUID : string;
    var plist = tl.which('/usr/libexec/PlistBuddy', true);
    var plistTool : ToolRunner = tl.createToolRunner(plist);
    plistTool.arg(['-c', 'Print UUID']);
    plistTool.pathArg(tmpPlist);
    plistTool.on('stdout', function (data) {
        if (data) {
            provProfileUUID = data.toString();
        }
    })
    await plistTool.exec();

    //delete the temporary plist file
    var deletePlistCommand : ToolRunner = tl.createToolRunner(tl.which('rm', true));
    deletePlistCommand.arg('-f');
    deletePlistCommand.pathArg(tmpPlist);
    await deletePlistCommand.exec();

    if(provProfileUUID) {
        //copy the provisioning profile file to ~/Library/MobileDevice/Provisioning Profiles
        tl.mkdirP(userProvisioningProfilesPath); // Path may not exist if Xcode has not been run yet.
        var pathToProvProfile : string = getProvisioningProfilePath(provProfileUUID);
        var copyProvProfileCmd : ToolRunner = tl.createToolRunner(tl.which('cp', true));
        copyProvProfileCmd.arg('-f');
        copyProvProfileCmd.pathArg(provProfilePath); //source
        copyProvProfileCmd.pathArg(pathToProvProfile); //dest
        await copyProvProfileCmd.exec();

        return provProfileUUID;
    } else {
        throw tl.loc('ProvProfileUUIDNotFound', provProfilePath);
    }
}

/**
 * Delete specified iOS keychain
 * @param keychainPath
 */
export async function deleteKeychain(keychainPath: string) {
    if (fs.existsSync(keychainPath)) {
        var deleteKeychainCommand : ToolRunner = tl.createToolRunner(tl.which('security', true));
        deleteKeychainCommand.arg('delete-keychain');
        deleteKeychainCommand.pathArg(keychainPath);
        await deleteKeychainCommand.exec();
    }
}

/**
 * Unlock specified iOS keychain
 * @param keychainPath
 * @param keychainPwd
 */
export async function unlockKeychain(keychainPath: string, keychainPwd: string) {
    //unlock the keychain
    var unlockCommand : ToolRunner = tl.createToolRunner(tl.which('security', true));
    unlockCommand.arg(['unlock-keychain', '-p', keychainPwd]);
    unlockCommand.pathArg(keychainPath);
    await unlockCommand.exec();
}

/**
 * Delete provisioning profile with specified UUID in the user's profiles directory
 * @param uuid
 */
export async function deleteProvisioningProfile(uuid: string) {
    var provProfilePath : string = getProvisioningProfilePath(uuid);
    tl.warning('Deleting provisioning profile: ' + provProfilePath);
    if(fs.existsSync(provProfilePath)) {
        tl.warning('Deleting provisioning profile: ' + provProfilePath);

        var deleteProfileCommand : ToolRunner = tl.createToolRunner(tl.which('rm', true));
        deleteProfileCommand.arg('-f');
        deleteProfileCommand.pathArg(provProfilePath);
        await deleteProfileCommand.exec();
    }
}

function getProvisioningProfilePath(uuid: string) : string {
    return path.join(userProvisioningProfilesPath, uuid.trim().concat('.mobileprovision'));
}

/**
 * Gets the path to the iOS default keychain
 */
export async function getDefaultKeychainPath() {
    var defaultKeychainPath : string;
    var getKeychainCmd : ToolRunner = tl.createToolRunner(tl.which('security', true));
    getKeychainCmd.arg('default-keychain');
    getKeychainCmd.on('stdout', function (data) {
        if (data) {
            defaultKeychainPath = data.toString().trim().replace(/[",\n\r\f\v]/gm, '');
        }
    })
    await getKeychainCmd.exec();
    return defaultKeychainPath;
}