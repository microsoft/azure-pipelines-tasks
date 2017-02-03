import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import {ToolRunner} from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get build inputs
        var solutionPath = tl.getPathInput('solution', true, true);
        var configuration = tl.getInput('configuration', true);
        var args = tl.getInput('args');
        var packageApp = tl.getBoolInput('packageApp');
        var buildForSimulator = tl.getBoolInput('forSimulator');
        var device = (buildForSimulator) ? 'iPhoneSimulator' : 'iPhone';
        tl.debug('device: ' + device);
        var xbuildLocation = tl.getInput('mdtoolLocation', false);
        var cwd = tl.getInput('cwd');
        let runNugetRestore : boolean = tl.getBoolInput('runNugetRestore');

        // Get path to xbuild
        var xbuildToolPath = undefined;
        if (xbuildLocation) {
            xbuildToolPath = path.join(xbuildLocation, 'xbuild');
            tl.checkPath(xbuildToolPath, 'xbuild');
        } else {
            xbuildToolPath = tl.which('xbuild', true);
        }

        if(runNugetRestore) {
            // Find location of nuget
            var nugetPath = tl.which('nuget', true);

            // Restore NuGet packages of the solution
            var nugetRunner = tl.tool(nugetPath);
            nugetRunner.arg(['restore', solutionPath]);
            await nugetRunner.exec();
        }

        //Process working directory
        var cwd = cwd || tl.getVariable('System.DefaultWorkingDirectory');
        tl.cd(cwd);

        var signMethod:string = tl.getInput('signMethod', false);
        var codesignKeychain:string;
        var profileToDelete:string;
        var provProfileUUID = null;
        var signIdentity = null;

        if (signMethod === 'file') {
            var p12:string = tl.getPathInput('p12', false, false);
            var p12pwd:string = tl.getInput('p12pwd', false);
            var provProfilePath:string = tl.getPathInput('provProfile', false);
            var removeProfile:boolean = tl.getBoolInput('removeProfile', false);

            if (tl.filePathSupplied('p12') && tl.exist(p12)) {
                p12 = tl.resolve(cwd, p12);
                tl.debug('cwd = ' + cwd);
                var keychain:string = tl.resolve(cwd, '_xamariniostasktmp.keychain');
                var keychainPwd:string = '_xamariniostask_TmpKeychain_Pwd#1';

                //create a temporary keychain and install the p12 into that keychain
                tl.debug('installed cert in temp keychain');
                await sign.installCertInTemporaryKeychain(keychain, keychainPwd, p12, p12pwd);
                codesignKeychain = keychain;

                //find signing identity
                signIdentity = await sign.findSigningIdentity(keychain);
            }

            //determine the provisioning profile UUID
            if (tl.filePathSupplied('provProfile') && tl.exist(provProfilePath)) {
                provProfileUUID = await sign.getProvisioningProfileUUID(provProfilePath);

                if (removeProfile && provProfileUUID) {
                    profileToDelete = provProfileUUID;
                }
            }
        } else if (signMethod === 'id') {
            var unlockDefaultKeychain:boolean = tl.getBoolInput('unlockDefaultKeychain');
            var defaultKeychainPassword:string = tl.getInput('defaultKeychainPassword');
            if (unlockDefaultKeychain) {
                var defaultKeychain:string = await sign.getDefaultKeychainPath();
                await sign.unlockKeychain(defaultKeychain, defaultKeychainPassword);
            }

            signIdentity = tl.getInput('iosSigningIdentity');
            provProfileUUID = tl.getInput('provProfileUuid');
        }

        // Prepare xbuild build command line
        var xbuildRunner = tl.tool(xbuildToolPath);
        xbuildRunner.arg(solutionPath);
        xbuildRunner.argIf(configuration, '/p:Configuration=' + configuration);
        xbuildRunner.argIf(device, '/p:Platform=' + device);
        xbuildRunner.argIf(packageApp, '/p:BuildIpa=true');
        if (args) {
            xbuildRunner.line(args);
        }
        xbuildRunner.argIf(codesignKeychain, '/p:CodesignKeychain=' + codesignKeychain);
        xbuildRunner.argIf(signIdentity, '/p:Codesignkey=' + signIdentity);
        xbuildRunner.argIf(provProfileUUID, '/p:CodesignProvision=' + provProfileUUID);

        // Execute build
        await xbuildRunner.exec();

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('XamariniOSSucceeded'));

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('XamariniOSFailed', err));
    } finally {
        //clean up the temporary keychain, so it is not used to search for code signing identity in future builds
        if (codesignKeychain) {
            try {
                await sign.deleteKeychain(codesignKeychain);
            } catch (err) {
                tl.debug('Failed to delete temporary keychain. Error = ' + err);
                tl.warning(tl.loc('TempKeychainDeleteFailed', codesignKeychain));
            }
        }

        //delete provisioning profile if specified
        if (profileToDelete) {
            try {
                await sign.deleteProvisioningProfile(profileToDelete);
            } catch (err) {
                tl.debug('Failed to delete provisioning profile. Error = ' + err);
                tl.warning(tl.loc('ProvProfileDeleteFailed', profileToDelete));
            }
        }
    }
}

run();