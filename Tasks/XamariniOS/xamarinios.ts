import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');
import msbuildhelpers = require('msbuildhelpers/msbuildhelpers');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

/**
 * Find all filenames starting from `rootDirectory` that match a wildcard pattern.
 * @param solutionPattern A filename pattern to evaluate, possibly containing wildcards.
 */
function expandSolutionWildcardPatterns(solutionPattern: string): string {
    const matchedSolutionFiles = tl.findMatch(null, solutionPattern, { followSymbolicLinks: false, followSpecifiedSymbolicLink: false });
    tl.debug(`Found ${matchedSolutionFiles ? matchedSolutionFiles.length : 0} solution files matching the pattern.`);

    if (matchedSolutionFiles && matchedSolutionFiles.length > 0) {
        const result = matchedSolutionFiles[0];
        if (matchedSolutionFiles.length > 1) {
            tl.warning(tl.loc('MultipleSolutionsFound', result));
        }

        return result;
    } else {
        throw tl.loc('SolutionDoesNotExist', solutionPattern);
    }
}

async function run() {
    let codesignKeychain: string;
    let profileToDelete: string;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get build inputs
        const solutionInput: string = tl.getPathInput('solution', true, false);
        const configuration: string = tl.getInput('configuration', true);
        const clean: boolean = tl.getBoolInput('clean');
        const args: string = tl.getInput('args');
        const packageApp: boolean = tl.getBoolInput('packageApp');
        const buildForSimulator: boolean = tl.getBoolInput('forSimulator');
        const device: string = (buildForSimulator) ? 'iPhoneSimulator' : 'iPhone';
        tl.debug('device: ' + device);
        const cwd: string = tl.getPathInput('cwd', false, true);
        const runNugetRestore: boolean = tl.getBoolInput('runNugetRestore');

        // find the build tool path based on the build tool and location inputs
        const buildTool: string = tl.getInput('buildTool');
        const buildToolLocation: string = tl.getInput('mdtoolLocation', false);
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

        const solutionPath = expandSolutionWildcardPatterns(solutionInput);

        if (clean) {
            const cleanBuildRunner: ToolRunner = tl.tool(buildToolPath);
            cleanBuildRunner.arg(solutionPath);
            cleanBuildRunner.argIf(configuration, '/p:Configuration=' + configuration);
            cleanBuildRunner.argIf(device, '/p:Platform=' + device);
            if (args) {
                cleanBuildRunner.line(args);
            }
            cleanBuildRunner.arg('/t:Clean');
            await cleanBuildRunner.exec();
        }

        if (runNugetRestore) {
            // Find location of nuget
            const nugetPath: string = tl.which('nuget', true);

            // Restore NuGet packages of the solution
            const nugetRunner: ToolRunner = tl.tool(nugetPath);
            nugetRunner.arg(['restore', solutionPath]);
            await nugetRunner.exec();
        }

        //Process working directory
        const workingDir: string = cwd || tl.getVariable('System.DefaultWorkingDirectory');
        tl.cd(workingDir);

        const signMethod: string = tl.getInput('signMethod', false);
        let provProfileUUID: string = null;
        let signIdentity: string = null;

        if (signMethod === 'file') {
            let p12: string = tl.getPathInput('p12', false, false);
            const p12pwd: string = tl.getInput('p12pwd', false);
            const provProfilePath: string = tl.getPathInput('provProfile', false);
            const removeProfile: boolean = tl.getBoolInput('removeProfile', false);

            if (tl.filePathSupplied('p12') && tl.exist(p12)) {
                p12 = tl.resolve(cwd, p12);
                tl.debug('cwd = ' + cwd);
                const keychain: string = tl.resolve(cwd, '_xamariniostasktmp.keychain');
                const keychainPwd: string = '_xamariniostask_TmpKeychain_Pwd#1';

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
            const unlockDefaultKeychain: boolean = tl.getBoolInput('unlockDefaultKeychain');
            const defaultKeychainPassword: string = tl.getInput('defaultKeychainPassword');
            if (unlockDefaultKeychain) {
                const defaultKeychain: string = await sign.getDefaultKeychainPath();
                await sign.unlockKeychain(defaultKeychain, defaultKeychainPassword);
            }

            signIdentity = tl.getInput('iosSigningIdentity');
            provProfileUUID = tl.getInput('provProfileUuid');
        }

        // Prepare xbuild build command line
        const buildRunner: ToolRunner = tl.tool(buildToolPath);
        buildRunner.arg(solutionPath);
        buildRunner.argIf(configuration, '/p:Configuration=' + configuration);
        buildRunner.argIf(device, '/p:Platform=' + device);
        buildRunner.argIf(packageApp, '/p:BuildIpa=true');
        if (args) {
            buildRunner.line(args);
        }
        buildRunner.argIf(codesignKeychain, '/p:CodesignKeychain=' + codesignKeychain);
        if (buildTool === 'msbuild' && signIdentity && signIdentity.indexOf(',') > 0) {
            // Escape the input to workaround msbuild bug https://github.com/Microsoft/msbuild/issues/471
            tl.debug('Escaping , in arg /p:Codesignkey to workaround msbuild bug.');
            const signIdentityEscaped = signIdentity.replace(/[,]/g, '%2C');
            buildRunner.arg('/p:Codesignkey=' + signIdentityEscaped);
        } else {
            tl.debug('Passing in arg /p:Codesignkey as is without escpaing any characters.')
            buildRunner.argIf(signIdentity, '/p:Codesignkey=' + signIdentity);
        }
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