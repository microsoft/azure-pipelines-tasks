/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/ios-signing-common.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import {ToolRunner} from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        //--------------------------------------------------------
        // Tooling
        //--------------------------------------------------------
        tl.setEnvVar('DEVELOPER_DIR', tl.getInput('xcodeDeveloperDir', false));

        var useXctool : boolean = tl.getBoolInput('useXctool', false);
        var tool : string = useXctool ? tl.which('xctool', true) : tl.which('xcodebuild', true);
        tl.debug('Tool selected: '+ tool);

        //--------------------------------------------------------
        // Paths
        //--------------------------------------------------------
        var workingDir : string = tl.getPathInput('cwd');
        tl.cd(workingDir);

        var outPath : string = path.resolve(workingDir, tl.getInput('outputPattern', true));
        tl.mkdirP(outPath);

        //--------------------------------------------------------
        // Xcode args
        //--------------------------------------------------------
        var ws : string = tl.getPathInput('xcWorkspacePath', false, false);
        if(tl.filePathSupplied('xcWorkspacePath')) {
            var workspaceMatches = tl.glob(ws);
            tl.debug("Found " + workspaceMatches.length + ' workspaces matching.');

            if (workspaceMatches.length > 0) {
                ws = workspaceMatches[0];
                if (workspaceMatches.length > 1) {
                    tl.warning('Multiple xcode workspace matches were found. Using the first match: ' + ws);
                }
            }
            else {
                throw 'Xcode workspace was specified but it does not exist or is not a directory';
            }
        }

        var sdk : string = tl.getInput('sdk', false);
        var configuration : string  = tl.getInput('configuration', false);
        var scheme : string = tl.getInput('scheme', false);
        var xctoolReporter : string = tl.getInput('xctoolReporter', false);
        var actions : string [] = tl.getDelimitedInput('actions', ' ', true);
        var packageApp : boolean = tl.getBoolInput('packageApp', true);
        var args : string = tl.getInput('args', false);

        //--------------------------------------------------------
        // Exec Tools
        //--------------------------------------------------------

        // --- Xcode Version ---
        var xcv : ToolRunner = tl.createToolRunner(tool);
        xcv.arg('-version');
        await xcv.exec();

        // --- Xcode build arguments ---
        var xcb: ToolRunner = tl.createToolRunner(tool);
        xcb.argIf(sdk, ['-sdk', sdk]);
        xcb.argIf(configuration, ['-configuration', configuration]);
        if(ws) {
            xcb.arg('-workspace');
            xcb.pathArg(ws);
        }
        xcb.argIf(scheme, ['-scheme', scheme]);
        xcb.argIf(useXctool && xctoolReporter, ['-reporter', 'plain', '-reporter', xctoolReporter]);
        xcb.arg(actions);
        xcb.arg('DSTROOT=' + path.join(outPath, 'build.dst'));
        xcb.arg('OBJROOT=' + path.join(outPath, 'build.obj'));
        xcb.arg('SYMROOT=' + path.join(outPath, 'build.sym'));
        xcb.arg('SHARED_PRECOMPS_DIR=' + path.join(outPath, 'build.pch'));
        if (args) {
            xcb.argString(args);
        }

        //--------------------------------------------------------
        // iOS signing and provisioning
        //--------------------------------------------------------
        var signMethod : string = tl.getInput('signMethod', false);
        var keychainToDelete : string;
        var profileToDelete : string;

        if(signMethod === 'file') {
            var p12 : string = tl.getPathInput('p12', false, false);
            var p12pwd : string = tl.getInput('p12pwd', false);
            var provProfilePath : string = tl.getPathInput('provProfile', false);
            var removeProfile : boolean = tl.getBoolInput('removeProfile', false);

            if(tl.filePathSupplied('p12')) {
                p12 = path.resolve(workingDir, p12);
                var keychain : string = path.join(workingDir, '_xcodetasktmp.keychain');
                var keychainPwd : string = Math.random().toString();

                //create a temporary keychain and install the p12 into that keychain
                await sign.installCertInTemporaryKeychain(keychain, keychainPwd, p12, p12pwd);
                xcb.arg('OTHER_CODE_SIGN_FLAGS=--keychain=' + keychain);
                keychainToDelete = keychain;

                //find signing identity
                var signIdentity = await sign.findSigningIdentity(keychain);
                xcb.arg('CODE_SIGN_IDENTITY=' + signIdentity);

                //determine the provisioning profile UUID
                var provProfileUUID = await sign.getProvisioningProfileUUID(provProfilePath);
                xcb.arg('PROVISIONING_PROFILE=' + provProfileUUID);

                if(removeProfile) {
                    profileToDelete = provProfileUUID;
                }
            }

        } else if (signMethod === 'id') {
            var unlockDefaultKeychain : boolean = tl.getBoolInput('unlockDefaultKeychain');
            var defaultKeychainPassword : string = tl.getInput('defaultKeychainPassword');
            if(unlockDefaultKeychain) {
                var defaultKeychain : string = await sign.getDefaultKeychainPath();
                await sign.unlockKeychain(defaultKeychain, defaultKeychainPassword);
            }

            var signIdentity : string = tl.getInput('iosSigningIdentity');
            xcb.arg('CODE_SIGN_IDENTITY=' + signIdentity);

            var provProfileUUID : string = tl.getInput('provProfileUuid');
            xcb.arg('PROVISIONING_PROFILE=' + provProfileUUID);
        }

        //--- Xcode Build ---
        await xcb.exec();

        //--------------------------------------------------------
        // Test publishing
        //--------------------------------------------------------
        var testResultsFiles : string;
        var publishResults : boolean = tl.getBoolInput('publishJUnitResults', false);
        if (publishResults && !useXctool) {
            tl.warning("Check the 'Use xctool' checkbox and specify the xctool reporter format to publish test results. No results published.");
        }

        if (publishResults && useXctool && xctoolReporter && 0 !== xctoolReporter.length)
        {
            var xctoolReporterString = xctoolReporter.split(":");
            if (xctoolReporterString && xctoolReporterString.length === 2)
            {
                testResultsFiles = path.resolve(workingDir, xctoolReporterString[1].trim());
            }

            if(testResultsFiles && 0 !== testResultsFiles.length) {
                //check for pattern in testResultsFiles
                if(testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
                    tl.debug('Pattern found in testResultsFiles parameter');
                    var allFiles : string [] = tl.find(workingDir);
                    var matchingTestResultsFiles : string [] = tl.match(allFiles, testResultsFiles, { matchBase: true });
                }
                else {
                    tl.debug('No pattern found in testResultsFiles parameter');
                    var matchingTestResultsFiles : string [] = [testResultsFiles];
                }

                if(!matchingTestResultsFiles) {
                    tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
                }

                var tp = new tl.TestPublisher("JUnit");
                tp.publish(matchingTestResultsFiles, false, "", "", "", true);
            }
        }

        //--------------------------------------------------------
        // Package app to generate .ipa
        //--------------------------------------------------------
        if(tl.getBoolInput('packageApp', true) && sdk !== 'iphonesimulator') {
            tl.debug('Packaging apps.');
            var buildOutputPath : string = path.join(outPath, 'build.sym');
            tl.debug('buildOutputPath: ' + buildOutputPath);
            var appFolders : string [] = tl.glob(buildOutputPath + '/**/*.app')
            if (appFolders) {
                tl.debug(appFolders.length + ' apps found for packaging.');
                var xcrunPath : string = tl.which('xcrun', true);
                for(var i = 0; i < appFolders.length; i++) {
                    var app : string = appFolders.pop();
                    tl.debug('Packaging ' + app);
                    var ipa : string = app.substring(0, app.length-3) + 'ipa';
                    var xcr : ToolRunner = tl.createToolRunner(xcrunPath);
                    xcr.arg(['-sdk', sdk, 'PackageApplication', '-v', app, '-o', ipa]);
                    await xcr.exec();
                }
            }
        }
        tl.setResult(tl.TaskResult.Succeeded, 'Xcode task execution completed with no errors.');
    }
    catch(err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        //delete provisioning profile if specified
        if(profileToDelete) {
            tl.warning('Deleting provisioning profile: ' + profileToDelete);
            await sign.deleteProvisioningProfile(profileToDelete);
        }

        //clean up the temporary keychain, so it is not used to search for code signing identity in future builds
        if(keychainToDelete) {
            await sign.deleteKeychain(keychainToDelete);
       }
    }
}

run();
