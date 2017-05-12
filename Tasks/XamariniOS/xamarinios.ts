import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');
import msbuildhelpers = require('msbuildhelpers/msbuildhelpers');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {

    let codesignKeychain: string;
    let profileToDelete: string;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get build inputs
        let solutionPath: string = tl.getPathInput('solution', true, true);
        let configuration: string = tl.getInput('configuration', true);
        let clean: boolean = tl.getBoolInput('clean');
        let args: string = tl.getInput('args');
        let packageApp: boolean = tl.getBoolInput('packageApp');
        let buildForSimulator: boolean = tl.getBoolInput('forSimulator');
        let device: string = (buildForSimulator) ? 'iPhoneSimulator' : 'iPhone';
        tl.debug('device: ' + device);
        let cwd: string = tl.getInput('cwd');
        let runNugetRestore: boolean = tl.getBoolInput('runNugetRestore');

        // find the build tool path based on the build tool and location inputs
        let buildTool: string = tl.getInput('buildTool');
        let buildToolLocation: string = tl.getInput('mdtoolLocation', false);
        let buildToolPath: string;
        if (buildToolLocation) {
            // location is specified
            buildToolPath = buildToolLocation;
            if (buildTool === 'xbuild' && !buildToolLocation.toLowerCase().endsWith('xbuild')) {
                buildToolPath = path.join(buildToolLocation, 'xbuild');
            }
            if (buildTool === 'msbuild' && !buildToolLocation.toLowerCase().endsWith('msbuild')) {
                buildToolPath = path.join(buildToolLocation, 'msbuild');
            }
        } else {
            // no build tool path is supplied, check PATH
            if (buildTool === 'msbuild') {
                // check for msbuild 15 or higher, if not fall back to xbuild
                buildToolPath = await msbuildhelpers.getMSBuildPath('15.0');
            } else {
                buildToolPath = tl.which('xbuild', true);
            }
        }
        tl.checkPath(buildToolPath, 'build tool');
        tl.debug('Build tool path = ' + buildToolPath);

        if (clean) {
            let cleanBuildRunner: ToolRunner = tl.tool(buildToolPath);
            cleanBuildRunner.arg(solutionPath);
            cleanBuildRunner.argIf(configuration, '/p:Configuration=' + configuration);
            cleanBuildRunner.argIf(device, '/p:Platform=' + device);
            cleanBuildRunner.arg('/t:Clean');
            await cleanBuildRunner.exec();
        }

        if (runNugetRestore) {
            // Find location of nuget
            let nugetPath: string = tl.which('nuget', true);

            // Restore NuGet packages of the solution
            let nugetRunner: ToolRunner = tl.tool(nugetPath);
            nugetRunner.arg(['restore', solutionPath]);
            await nugetRunner.exec();
        }

        //Process working directory
        let workingDir: string = cwd || tl.getVariable('System.DefaultWorkingDirectory');
        tl.cd(workingDir);

        let signMethod: string = tl.getInput('signMethod', false);
        let provProfileUUID: string = null;
        let signIdentity: string = null;

        if (signMethod === 'file') {
            let p12: string = tl.getPathInput('p12', false, false);
            let p12pwd: string = tl.getInput('p12pwd', false);
            let provProfilePath: string = tl.getPathInput('provProfile', false);
            let removeProfile: boolean = tl.getBoolInput('removeProfile', false);

            if (tl.filePathSupplied('p12') && tl.exist(p12)) {
                p12 = tl.resolve(cwd, p12);
                tl.debug('cwd = ' + cwd);
                let keychain: string = tl.resolve(cwd, '_xamariniostasktmp.keychain');
                let keychainPwd: string = '_xamariniostask_TmpKeychain_Pwd#1';

                //create a temporary keychain and install the p12 into that keychain
                tl.debug('installing cert in temp keychain');
                await sign.installCertInTemporaryKeychain(keychain, keychainPwd, p12, p12pwd, false);
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
            let unlockDefaultKeychain: boolean = tl.getBoolInput('unlockDefaultKeychain');
            let defaultKeychainPassword: string = tl.getInput('defaultKeychainPassword');
            if (unlockDefaultKeychain) {
                let defaultKeychain: string = await sign.getDefaultKeychainPath();
                await sign.unlockKeychain(defaultKeychain, defaultKeychainPassword);
            }

            signIdentity = tl.getInput('iosSigningIdentity');
            provProfileUUID = tl.getInput('provProfileUuid');
        }

        // Prepare xbuild build command line
        let buildRunner: ToolRunner = tl.tool(buildToolPath);
        buildRunner.arg(solutionPath);
        buildRunner.argIf(configuration, '/p:Configuration=' + configuration);
        buildRunner.argIf(device, '/p:Platform=' + device);
        buildRunner.argIf(packageApp, '/p:BuildIpa=true');
        if (args) {
            buildRunner.line(args);
        }
        buildRunner.argIf(codesignKeychain, '/p:CodesignKeychain=' + codesignKeychain);
        buildRunner.argIf(signIdentity, '/p:Codesignkey=' + signIdentity);
        buildRunner.argIf(provProfileUUID, '/p:CodesignProvision=' + provProfileUUID);

        // Execute build
        await buildRunner.exec();

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