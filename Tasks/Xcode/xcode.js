/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/ios-signing-common.d.ts" />
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const path = require('path');
const tl = require('vsts-task-lib/task');
const sign = require('ios-signing-common/ios-signing-common');
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            tl.setResourcePath(path.join(__dirname, 'task.json'));
            //--------------------------------------------------------
            // Tooling
            //--------------------------------------------------------
            tl.setEnvVar('DEVELOPER_DIR', tl.getInput('xcodeDeveloperDir', false));
            var useXctool = tl.getBoolInput('useXctool', false);
            var tool = useXctool ? tl.which('xctool', true) : tl.which('xcodebuild', true);
            tl.debug('Tool selected: ' + tool);
            //--------------------------------------------------------
            // Paths
            //--------------------------------------------------------
            var workingDir = tl.getPathInput('cwd');
            tl.cd(workingDir);
            var outPath = path.resolve(workingDir, tl.getInput('outputPattern', true));
            tl.mkdirP(outPath);
            //--------------------------------------------------------
            // Xcode args
            //--------------------------------------------------------
            var ws = tl.getPathInput('xcWorkspacePath', false, false);
            if (tl.filePathSupplied('xcWorkspacePath')) {
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
            var sdk = tl.getInput('sdk', false);
            var configuration = tl.getInput('configuration', false);
            var scheme = tl.getInput('scheme', false);
            var xctoolReporter = tl.getInput('xctoolReporter', false);
            var actions = tl.getDelimitedInput('actions', ' ', true);
            var packageApp = tl.getBoolInput('packageApp', true);
            var args = tl.getInput('args', false);
            //--------------------------------------------------------
            // Exec Tools
            //--------------------------------------------------------
            // --- Xcode Version ---
            var xcv = tl.createToolRunner(tool);
            xcv.arg('-version');
            yield xcv.exec();
            // --- Xcode build arguments ---
            var xcb = tl.createToolRunner(tool);
            xcb.argIf(sdk, ['-sdk', sdk]);
            xcb.argIf(configuration, ['-configuration', configuration]);
            if (ws) {
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
            var signMethod = tl.getInput('signMethod', false);
            var keychainToDelete;
            var profileToDelete;
            if (signMethod === 'file') {
                var p12 = tl.getPathInput('p12', false, false);
                var p12pwd = tl.getInput('p12pwd', false);
                var provProfilePath = tl.getPathInput('provProfile', false);
                var removeProfile = tl.getBoolInput('removeProfile', false);
                if (tl.filePathSupplied('p12')) {
                    p12 = path.resolve(workingDir, p12);
                    var keychain = path.join(workingDir, '_xcodetasktmp.keychain');
                    var keychainPwd = Math.random().toString();
                    //create a temporary keychain and install the p12 into that keychain
                    yield sign.installCertInTemporaryKeychain(keychain, keychainPwd, p12, p12pwd);
                    xcb.arg('OTHER_CODE_SIGN_FLAGS=--keychain=' + keychain);
                    keychainToDelete = keychain;
                    //find signing identity
                    var signIdentity = yield sign.findSigningIdentity(keychain);
                    xcb.arg('CODE_SIGN_IDENTITY=' + signIdentity);
                    //determine the provisioning profile UUID
                    var provProfileUUID = yield sign.getProvisioningProfileUUID(provProfilePath);
                    xcb.arg('PROVISIONING_PROFILE=' + provProfileUUID);
                    if (removeProfile) {
                        profileToDelete = provProfileUUID;
                    }
                }
            }
            else if (signMethod === 'id') {
                var unlockDefaultKeychain = tl.getBoolInput('unlockDefaultKeychain');
                var defaultKeychainPassword = tl.getInput('defaultKeychainPassword');
                if (unlockDefaultKeychain) {
                    var defaultKeychain = yield sign.getDefaultKeychainPath();
                    yield sign.unlockKeychain(defaultKeychain, defaultKeychainPassword);
                }
                var signIdentity = tl.getInput('iosSigningIdentity');
                xcb.arg('CODE_SIGN_IDENTITY=' + signIdentity);
                var provProfileUUID = tl.getInput('provProfileUuid');
                xcb.arg('PROVISIONING_PROFILE=' + provProfileUUID);
            }
            //--- Xcode Build ---
            yield xcb.exec();
            //--------------------------------------------------------
            // Test publishing
            //--------------------------------------------------------
            var testResultsFiles;
            var publishResults = tl.getBoolInput('publishJUnitResults', false);
            if (publishResults && !useXctool) {
                tl.warning("Check the 'Use xctool' checkbox and specify the xctool reporter format to publish test results. No results published.");
            }
            if (publishResults && useXctool && xctoolReporter && 0 !== xctoolReporter.length) {
                var xctoolReporterString = xctoolReporter.split(":");
                if (xctoolReporterString && xctoolReporterString.length === 2) {
                    testResultsFiles = path.resolve(workingDir, xctoolReporterString[1].trim());
                }
                if (testResultsFiles && 0 !== testResultsFiles.length) {
                    //check for pattern in testResultsFiles
                    if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
                        tl.debug('Pattern found in testResultsFiles parameter');
                        var allFiles = tl.find(workingDir);
                        var matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, { matchBase: true });
                    }
                    else {
                        tl.debug('No pattern found in testResultsFiles parameter');
                        var matchingTestResultsFiles = [testResultsFiles];
                    }
                    if (!matchingTestResultsFiles) {
                        tl.warning('No test result files matching ' + testResultsFiles + ' were found, so publishing JUnit test results is being skipped.');
                    }
                    var tp = new tl.TestPublisher("JUnit");
                    tp.publish(matchingTestResultsFiles, false, "", "", "", true);
                }
            }
            //--------------------------------------------------------
            // Package app to generate .ipa
            //--------------------------------------------------------
            if (tl.getBoolInput('packageApp', true) && sdk !== 'iphonesimulator') {
                tl.debug('Packaging apps.');
                var buildOutputPath = path.join(outPath, 'build.sym');
                tl.debug('buildOutputPath: ' + buildOutputPath);
                var appFolders = tl.glob(buildOutputPath + '/**/*.app');
                if (appFolders) {
                    tl.debug(appFolders.length + ' apps found for packaging.');
                    var xcrunPath = tl.which('xcrun', true);
                    for (var i = 0; i < appFolders.length; i++) {
                        var app = appFolders.pop();
                        tl.debug('Packaging ' + app);
                        var ipa = app.substring(0, app.length - 3) + 'ipa';
                        var xcr = tl.createToolRunner(xcrunPath);
                        xcr.arg(['-sdk', sdk, 'PackageApplication', '-v', app, '-o', ipa]);
                        yield xcr.exec();
                    }
                }
            }
            tl.setResult(tl.TaskResult.Succeeded, 'Xcode task execution completed with no errors.');
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err);
        }
        finally {
            //delete provisioning profile if specified
            if (profileToDelete) {
                tl.warning('Deleting provisioning profile: ' + profileToDelete);
                yield sign.deleteProvisioningProfile(profileToDelete);
            }
            //clean up the temporary keychain, so it is not used to search for code signing identity in future builds
            if (keychainToDelete) {
                yield sign.deleteKeychain(keychainToDelete);
            }
        }
    });
}
run();
