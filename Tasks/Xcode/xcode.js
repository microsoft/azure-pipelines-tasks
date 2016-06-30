/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
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
const fs = require('fs');
const sign = require('ios-signing-common/ios-signing-common');
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            tl.setResourcePath(path.join(__dirname, 'task.json'));
            // if output is rooted ($(build.buildDirectory)/output/...), will resolve to fully qualified path,
            // else relative to repo root
            var buildSourceDirectory = tl.getVariable('build.sourcesDirectory');
            var out = path.resolve(buildSourceDirectory, tl.getInput('outputPattern', true));
            //Process working directory
            var cwd = tl.getInput('cwd') || buildSourceDirectory;
            tl.cd(cwd);
            tl.debug('current working dir = ' + cwd);
            // Create output directory if not present
            tl.mkdirP(out);
            // Store original Xcode developer directory so we can restore it after build completes if its overridden
            /* var origXcodeDeveloperDir = process.env['DEVELOPER_DIR'];
     
             // Set the path to the developer tools for this process call if not the default
             var xcodeDeveloperDir = tl.getInput('xcodeDeveloperDir', false);
             if(xcodeDeveloperDir) {
                 tl.debug('DEVELOPER_DIR was ' + origXcodeDeveloperDir)
                 tl.debug('DEVELOPER_DIR for build set to ' + xcodeDeveloperDir);
                 process.env['DEVELOPER_DIR'] = xcodeDeveloperDir;
             }*/
            // Use xctool or xcodebuild based on flag
            var useXctool = tl.getBoolInput('useXctool', false);
            var tool = useXctool ? tl.which('xctool', true) : tl.which('xcodebuild', true);
            tl.debug('Tool selected: ' + tool);
            // Get version
            var xcv = tl.createToolRunner(tool);
            xcv.arg('-version');
            yield xcv.exec();
            //setup build
            var xcb = tl.createToolRunner(tool);
            // Add common arguments for the build
            var sdk = tl.getInput('sdk', false); //sdk is not required for watchkit
            if (sdk) {
                xcb.arg('-sdk');
                xcb.arg(sdk);
            }
            var configuration = tl.getInput('configuration', false);
            if (configuration) {
                xcb.arg('-configuration');
                xcb.arg(configuration);
            }
            // Args: Add optional workspace flag
            var workspace = tl.getPathInput('xcWorkspacePath', false, false);
            if (tl.filePathSupplied('xcWorkspacePath')) {
                var workspaceMatches = tl.glob(workspace);
                tl.debug("Found " + workspaceMatches.length + ' workspaces matching.');
                if (workspaceMatches.length > 0) {
                    if (workspaceMatches.length > 1) {
                        tl.warning('multiple workspace matches.  using first.');
                    }
                    xcb.arg('-workspace');
                    xcb.pathArg(workspaceMatches[0]);
                }
                else {
                    throw 'Workspace specified but it does not exist or is not a directory';
                }
            }
            else {
                tl.debug('No workspace path specified in task.');
            }
            // Args: Add optional scheme flag
            var scheme = tl.getInput('scheme', false);
            if (scheme) {
                xcb.arg('-scheme');
                xcb.arg(scheme);
            }
            else {
                tl.debug('No scheme specified in task.');
            }
            // Args: Add output path config
            xcb.arg(tl.getDelimitedInput('actions', ' ', true));
            xcb.arg('DSTROOT=' + path.join(out, 'build.dst'));
            xcb.arg('OBJROOT=' + path.join(out, 'build.obj'));
            xcb.arg('SYMROOT=' + path.join(out, 'build.sym'));
            xcb.arg('SHARED_PRECOMPS_DIR=' + path.join(out, 'build.pch'));
            //additional args
            var args = tl.getInput('args', false);
            if (args) {
                xcb.argString(args);
            }
            //Test Results publish inputs
            var testResultsFiles;
            var publishResults = tl.getBoolInput('publishJUnitResults', false);
            var xctoolReporter = tl.getInput('xctoolReporter', false);
            if (xctoolReporter && 0 !== xctoolReporter.length) {
                var xctoolReporterString = xctoolReporter.split(":");
                if (xctoolReporterString && xctoolReporterString.length === 2) {
                    testResultsFiles = path.resolve(cwd, xctoolReporterString[1].trim());
                }
            }
            tl.debug('testResultsFiles = ' + testResultsFiles);
            if (useXctool) {
                if (xctoolReporter) {
                    xcb.arg(['-reporter', 'plain', '-reporter', xctoolReporter]);
                }
            }
            //signing options
            var signMethod = tl.getInput('signMethod', false);
            var keychainToDelete;
            var profileToDelete;
            if (signMethod === 'file') {
                var p12 = tl.getPathInput('p12', false, false);
                var p12pwd = tl.getInput('p12pwd', false);
                var provProfilePath = tl.getPathInput('provProfile', false);
                var removeProfile = tl.getBoolInput('removeProfile', false);
                //create a temporary keychain and install the p12 into that keychain
                if (p12 && fs.lstatSync(p12).isFile()) {
                    p12 = path.resolve(cwd, p12);
                    var keychain = path.join(cwd, '_xcodetasktmp.keychain');
                    var keychainPwd = Math.random();
                    yield sign.installCertInTemporaryKeyChain(keychain, keychainPwd.toString(), p12, p12pwd);
                    xcb.arg('OTHER_CODE_SIGN_FLAGS=--keychain=' + keychain);
                    keychainToDelete = keychain;
                    //find signing identity
                    var signIdentity = yield sign.findSigningIdentity(keychain);
                    xcb.arg('CODE_SIGN_IDENTITY=' + signIdentity);
                    var provProfileUUID = yield sign.getProvisioningProfileUUID(provProfilePath);
                    xcb.arg('PROVISIONING_PROFILE=' + provProfileUUID);
                    if (removeProfile) {
                        profileToDelete = provProfileUUID;
                    }
                }
            }
            else if (signMethod === 'id') {
            }
            //run the Xcode build
            yield xcb.exec();
            //publish test results
            if (publishResults) {
                if (!useXctool) {
                    tl.warning("Check the 'Use xctool' checkbox and specify the xctool reporter format to publish test results. No results published.");
                }
                if (testResultsFiles && 0 !== testResultsFiles.length) {
                    //check for pattern in testResultsFiles
                    if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
                        tl.debug('Pattern found in testResultsFiles parameter');
                        var allFiles = tl.find(cwd);
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
            //package apps to generate the .ipa
            if (tl.getBoolInput('packageApp', true) && sdk !== 'iphonesimulator') {
                tl.debug('Packaging apps.');
                var outPath = path.join(out, 'build.sym');
                tl.debug('outPath: ' + outPath);
                var appFolders = tl.glob(outPath + '/**/*.app');
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
                yield sign.deleteProvisioningProfile(profileToDelete);
            }
            //clean up the temporary keychain, so it is not used in future builds
            if (keychainToDelete) {
                yield sign.deleteKeychain(keychainToDelete);
            }
        }
    });
}
run();
