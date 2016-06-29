/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

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
        var origXcodeDeveloperDir = process.env['DEVELOPER_DIR'];

        // Set the path to the developer tools for this process call if not the default
        var xcodeDeveloperDir = tl.getInput('xcodeDeveloperDir', false);
        if(xcodeDeveloperDir) {
            tl.debug('DEVELOPER_DIR was ' + origXcodeDeveloperDir)
            tl.debug('DEVELOPER_DIR for build set to ' + xcodeDeveloperDir);
            process.env['DEVELOPER_DIR'] = xcodeDeveloperDir;
        }

        // Use xctool or xcodebuild based on flag
        var useXctool = tl.getBoolInput('useXctool', false);
        var tool = useXctool ? tl.which('xctool', true) : tl.which('xcodebuild', true);
        tl.debug('Tool selected: '+ tool);

        // Get version
        var xcv = tl.createToolRunner(tool);
        xcv.arg('-version');
        await xcv.exec();

        //setup build
        var xcb = tl.createToolRunner(tool);

        // Add common arguments for the build
        var sdk = tl.getInput('sdk', false); //sdk is not required for watchkit
        if(sdk) {
            xcb.arg('-sdk');
            xcb.arg(sdk);
        }
        var configuration = tl.getInput('configuration', false);
        if(configuration) {
            xcb.arg('-configuration');
            xcb.arg(configuration);
        }

        // Args: Add optional workspace flag
        var workspace = tl.getPathInput('xcWorkspacePath', false, false);
        if(tl.filePathSupplied('xcWorkspacePath')) {

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
        } else {
            tl.debug('No workspace path specified in task.');
        }

        // Args: Add optional scheme flag
        var scheme = tl.getInput('scheme', false);
        if(scheme) {
            xcb.arg('-scheme');
            xcb.arg(scheme);
        } else {
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
        if(args) {
            xcb.argString(args);
        }

        //Test Results publish inputs
        var testResultsFiles;
        var publishResults = tl.getBoolInput('publishJUnitResults', false);
        var xctoolReporter = tl.getInput('xctoolReporter', false);
        if (xctoolReporter && 0 !== xctoolReporter.length)
        {
            var xctoolReporterString = xctoolReporter.split(":");
            if (xctoolReporterString && xctoolReporterString.length === 2)
            {
                testResultsFiles = path.resolve(cwd, xctoolReporterString[1].trim());
            }
        }
        tl.debug('testResultsFiles = ' + testResultsFiles);
        if(useXctool) {
            if(xctoolReporter) {
                xcb.arg(['-reporter', 'plain', '-reporter', xctoolReporter])
            }
        }

        //signing options
        var signMethod = tl.getInput('signMethod', false);
        var deleteKeyChain : boolean = false;
        var deleteKeyChainCommand;
        var deleteProfile : boolean = false;
        var deleteProfileCommand;
        if(signMethod === 'file') {
            var iosSecurityTool = tl.which('/usr/bin/security', true);

            var p12 = tl.getPathInput('p12', false, false);
            var p12pwd = tl.getInput('p12pwd', false);
            var provProfilePath = tl.getPathInput('provProfile', false);
            var removeProfile = tl.getBoolInput('removeProfile', false);

            //create a temporary keychain and install the p12 into that keychain
            if(p12 && fs.lstatSync(p12).isFile()) {
                p12 = path.resolve(cwd, p12);
                var keychain = path.join(cwd, '_xcodetasktmp.keychain');

                //delete keychain if it exists
                deleteKeyChainCommand = tl.createToolRunner(iosSecurityTool);
                deleteKeyChainCommand.arg('delete-keychain');
                deleteKeyChainCommand.pathArg(keychain);
                if (fs.existsSync(keychain)) {
                    await deleteKeyChainCommand.exec();
                }

                //create keychain
                var keychainPwd = Math.random();
                var createKeychain = tl.createToolRunner(iosSecurityTool);
                createKeychain.arg('create-keychain');
                createKeychain.arg('-p');
                createKeychain.arg(keychainPwd.toString());
                createKeychain.pathArg(keychain);
                await createKeychain.exec();

                //we should clean up the keychain after the build is run
                deleteKeyChain = true;

                //set keychain settings
                var keychainSettings = tl.createToolRunner(iosSecurityTool);
                keychainSettings.arg('set-keychain-settings');
                keychainSettings.arg('-lut');
                keychainSettings.arg('7200');
                keychainSettings.pathArg(keychain);
                await keychainSettings.exec();

                //unlock the keychain
                var unlock = tl.createToolRunner(iosSecurityTool);
                unlock.arg('unlock-keychain');
                unlock.arg('-p');
                unlock.arg(keychainPwd.toString());
                unlock.pathArg(keychain);
                await unlock.exec();

                //import p12 cert into the keychain
                var importP12 = tl.createToolRunner(iosSecurityTool);
                importP12.arg('import');
                importP12.pathArg(p12);
                importP12.arg('-P');
                importP12.arg(p12pwd);
                importP12.arg(['-A', '-t', 'cert', '-f', 'pkcs12', '-k']);
                importP12.arg(keychain);
                await importP12.exec();

                xcb.arg('OTHER_CODE_SIGN_FLAGS=--keychain=' + keychain);

                //find signing identity
                var signIdentity;
                var findIdentity = tl.createToolRunner(iosSecurityTool);
                findIdentity.arg(['find-identity', '-v', '-p', 'codesigning']);
                findIdentity.pathArg(keychain);
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
                    xcb.arg('CODE_SIGN_IDENTITY=' + signIdentity);
                } else {
                    throw 'Failed to find iOS signing identity. Verify the signing and provisioning information provided.';
                }

                //find the provisioning profile UUID
                var provProfileDetails;
                var getProvProfileDetails = tl.createToolRunner(iosSecurityTool);
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
                    var tmpPlist = path.join(cwd, '_xcodetasktmp.plist');
                    fs.writeFileSync(tmpPlist, provProfileDetails);
                } else {
                    throw 'Failed to find the details for specified provisioning profile.';
                }

                //use PlistBuddy to figure out the UUID
                var plist = tl.which('/usr/libexec/PlistBuddy', true);
                var plistTool = tl.createToolRunner(plist);
                plistTool.arg(['-c', 'Print UUID']);
                plistTool.pathArg(tmpPlist);
                var provProfileUUID;
                plistTool.on('stdout', function (data) {
                    if (data) {
                        provProfileUUID = data;
                    }
                })
                await plistTool.exec();

                //delete the temporary plist file
                var deletePlistCommand = tl.createToolRunner(tl.which('rm', true));
                deletePlistCommand.arg('-f');
                deletePlistCommand.pathArg(tmpPlist);
                await deletePlistCommand.exec();

                if(provProfileUUID) {
                    xcb.arg('PROVISIONING_PROFILE=' + provProfileUUID);

                    //copy the provisioning profile file to ~/Library/MobileDevice/Provisioning Profiles
                    var userProfilesPath = path.join(process.env['HOME'], 'Library', 'MobileDevice', 'Provisioning Profiles');
                    tl.mkdirP(userProfilesPath); // Path may not exist if Xcode has not been run yet.
                    var pathToProvProfile = path.join(userProfilesPath, provProfileUUID.toString().trim().concat('.mobileprovision'));
                    tl.debug('pathToProvProfile = ' + pathToProvProfile);
                    var copyProvProfile = tl.createToolRunner(tl.which('cp', true));
                    copyProvProfile.arg('-f');
                    copyProvProfile.pathArg(provProfilePath); //source
                    copyProvProfile.pathArg(pathToProvProfile); //dest
                    await copyProvProfile.exec();

                    //setup to delete profile after build
                    deleteProfile = tl.getBoolInput('removeProfile', false);
                    if(deleteProfile && fs.existsSync(pathToProvProfile)) {
                        deleteProfileCommand = tl.createToolRunner(tl.which('rm', true));
                        deleteProfileCommand.arg('-f');
                        deleteProfileCommand.pathArg(pathToProvProfile);
                    }
                } else {
                    throw 'Failed to find provisioning profile UUID.';
                }
            }

        } else if (signMethod === 'id') {
            //TODO
        }

        //run the Xcode build
        await xcb.exec();

        //publish test results
        if(publishResults) {
            if (!useXctool) {
                tl.warning("Check the 'Use xctool' checkbox and specify the xctool reporter format to publish test results. No results published.");
            }

            if(testResultsFiles && 0 !== testResultsFiles.length) {
                //check for pattern in testResultsFiles
                if(testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
                    tl.debug('Pattern found in testResultsFiles parameter');
                    var allFiles = tl.find(cwd);
                    var matchingTestResultsFiles = tl.match(allFiles, testResultsFiles, { matchBase: true });
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

        //package apps to generate the .ipa
        if(tl.getBoolInput('packageApp', true) && sdk !== 'iphonesimulator') {
            tl.debug('Packaging apps.');
            var outPath = path.join(out, 'build.sym');
            tl.debug('outPath: ' + outPath);
            var appFolders = tl.glob(outPath + '/**/*.app')
            if (appFolders) {
                tl.debug(appFolders.length + ' apps found for packaging.');
                var xcrunPath = tl.which('xcrun', true);
                for(var i = 0; i < appFolders.length; i++) {
                    var app = appFolders.pop();
                    tl.debug('Packaging ' + app);
                    var ipa = app.substring(0, app.length-3) + 'ipa';
                    var xcr = tl.createToolRunner(xcrunPath);
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
        if(deleteProfile && deleteProfileCommand) {
            await deleteProfileCommand.exec();
        }

        //clean up the temporary keychain, so it is not used in future builds
        if(deleteKeyChain && deleteKeyChainCommand) {
            await deleteKeyChainCommand.exec();
        }
    }
}

run();
