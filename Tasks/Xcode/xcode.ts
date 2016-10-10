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

        var outPath : string = tl.resolve(workingDir, tl.getInput('outputPattern', true)); //use posix implementation to resolve paths to prevent unit test failures on Windows
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
                    tl.warning(tl.loc('MultipleWorkspacesFound', ws));
                }
            }
            else {
                throw tl.loc('WorkspaceDoesNotExist', ws);
            }
        }

        var sdk : string = tl.getInput('sdk', false);
        var configuration : string  = tl.getInput('configuration', false);
        var scheme : string = tl.getInput('scheme', false);
        var useXcpretty : boolean = tl.getBoolInput('useXcpretty', false);
        var xctoolReporter : string = tl.getInput('xctoolReporter', false);
        var actions : string [] = tl.getDelimitedInput('actions', ' ', true);
        var packageApp : boolean = tl.getBoolInput('packageApp', true);
        var args : string = tl.getInput('args', false);

        //--------------------------------------------------------
        // Exec Tools
        //--------------------------------------------------------

        // --- Xcode Version ---
        var xcv : ToolRunner = tl.tool(tool);
        xcv.arg('-version');
        var xcodeVersion: number = 0;
        xcv.on('stdout', (data) => {
            var match = data.toString().trim().match(/Xcode (.+)/g);
            tl.debug('match = ' + match);
            if (match) {
                var version: number = parseInt(match.toString().replace('Xcode', '').trim());
                tl.debug('version = ' + version);
                if(!isNaN(version)) {
                    xcodeVersion = version;
                }
            }
        });

        await xcv.exec();
        tl.debug('xcodeVersion = ' + xcodeVersion);

        // --- Xcode build arguments ---
        var xcb: ToolRunner = tl.tool(tool);
        xcb.argIf(sdk, ['-sdk', sdk]);
        xcb.argIf(configuration, ['-configuration', configuration]);
        if(ws && tl.filePathSupplied('xcWorkspacePath')) {
            xcb.arg('-workspace');
            xcb.arg(ws);
        }
        xcb.argIf(scheme, ['-scheme', scheme]);
        xcb.argIf(useXctool && xctoolReporter, ['-reporter', 'plain', '-reporter', xctoolReporter]);
        xcb.arg(actions);
        if(actions.toString().indexOf('archive') < 0) {
            // redirect build output if archive action is not passed
            // xcodebuild archive produces an invalid archive if output is redirected
            xcb.arg('DSTROOT=' + tl.resolve(outPath, 'build.dst'));
            xcb.arg('OBJROOT=' + tl.resolve(outPath, 'build.obj'));
            xcb.arg('SYMROOT=' + tl.resolve(outPath, 'build.sym'));
            xcb.arg('SHARED_PRECOMPS_DIR=' + tl.resolve(outPath, 'build.pch'));
        }
        if (args) {
            xcb.line(args);
        }

        //--------------------------------------------------------
        // iOS signing and provisioning
        //--------------------------------------------------------
        var signMethod : string = tl.getInput('signMethod', false);
        var keychainToDelete : string;
        var profileToDelete : string;
        var automaticSigningWithXcode: boolean = tl.getBoolInput('xcode8AutomaticSigning');
        var xcode_otherCodeSignFlags: string;
        var xcode_codeSignIdentity: string;
        var xcode_provProfile: string;
        var xcode_devTeam: string;

        if(signMethod === 'file') {
            var p12 : string = tl.getPathInput('p12', false, false);
            var p12pwd : string = tl.getInput('p12pwd', false);
            var provProfilePath : string = tl.getPathInput('provProfile', false);
            var removeProfile : boolean = tl.getBoolInput('removeProfile', false);

            if(tl.filePathSupplied('p12') && tl.exist(p12)) {
                p12 = tl.resolve(workingDir, p12);
                var keychain : string = tl.resolve(workingDir, '_xcodetasktmp.keychain');
                var keychainPwd : string = '_xcodetask_TmpKeychain_Pwd#1';

                //create a temporary keychain and install the p12 into that keychain
                await sign.installCertInTemporaryKeychain(keychain, keychainPwd, p12, p12pwd);
                xcode_otherCodeSignFlags = 'OTHER_CODE_SIGN_FLAGS=--keychain=' + keychain;
                xcb.arg(xcode_otherCodeSignFlags);
                keychainToDelete = keychain;

                //find signing identity
                var signIdentity = await sign.findSigningIdentity(keychain);
                if(signIdentity && !automaticSigningWithXcode) {
                    xcode_codeSignIdentity = 'CODE_SIGN_IDENTITY=' + signIdentity;
                }
            }

            //determine the provisioning profile UUID
            if(tl.filePathSupplied('provProfile') && tl.exist(provProfilePath)) {
                var provProfileUUID = await sign.getProvisioningProfileUUID(provProfilePath);
                if(provProfileUUID && !automaticSigningWithXcode) {
                    xcode_provProfile = 'PROVISIONING_PROFILE=' + provProfileUUID;
                }
                if (removeProfile && provProfileUUID) {
                    profileToDelete = provProfileUUID;
                }
            }

        } else if (signMethod === 'id') {
            var unlockDefaultKeychain : boolean = tl.getBoolInput('unlockDefaultKeychain');
            var defaultKeychainPassword : string = tl.getInput('defaultKeychainPassword');
            if (unlockDefaultKeychain) {
                var defaultKeychain : string = await sign.getDefaultKeychainPath();
                await sign.unlockKeychain(defaultKeychain, defaultKeychainPassword);
            }

            var signIdentity : string = tl.getInput('iosSigningIdentity');
            if (signIdentity && !automaticSigningWithXcode) {
                xcode_codeSignIdentity = 'CODE_SIGN_IDENTITY=' + signIdentity;
            }

            var provProfileUUID:string = tl.getInput('provProfileUuid');
            if (provProfileUUID && !automaticSigningWithXcode) {
                xcode_provProfile = 'PROVISIONING_PROFILE=' + provProfileUUID;
            }
        }
        xcb.argIf(xcode_codeSignIdentity, xcode_codeSignIdentity);
        xcb.argIf(xcode_provProfile, xcode_provProfile);

        var teamId : string = tl.getInput('teamId');
        if(teamId && automaticSigningWithXcode) {
            xcode_devTeam = 'DEVELOPMENT_TEAM=' + teamId;
        }
        xcb.argIf(xcode_devTeam, xcode_devTeam);

        //--- Enable Xcpretty formatting if using xcodebuild ---
        if(useXctool && useXcpretty) {
            tl.warning(tl.loc('XcodebuildRequiredForXcpretty'));
        }
        if(!useXctool && useXcpretty) {
            var xcPrettyPath: string = tl.which('xcpretty', true);
            var xcPrettyTool: ToolRunner = tl.tool(xcPrettyPath);
            xcPrettyTool.arg(['-r', 'junit', '--no-color']);

            xcb.pipeExecOutputToTool(xcPrettyTool);
        }

        //--- Xcode Build ---
        await xcb.exec();

        //--------------------------------------------------------
        // Test publishing
        //--------------------------------------------------------
        var testResultsFiles : string;
        var publishResults : boolean = tl.getBoolInput('publishJUnitResults', false);

        if (publishResults)
        { 
            if(useXctool) {
             if(xctoolReporter && 0 !== xctoolReporter.length) {
                 var xctoolReporterString = xctoolReporter.split(":");
                 if (xctoolReporterString && xctoolReporterString.length === 2) {
                     testResultsFiles = tl.resolve(workingDir, xctoolReporterString[1].trim());
                 }
             } else {
                 tl.warning(tl.loc('UseXcToolForTestPublishing'))
             }
            } else if(!useXctool) {
                if(!useXcpretty) {
                    tl.warning(tl.loc('UseXcprettyForTestPublishing'));
                } else {
                    testResultsFiles = tl.resolve(workingDir, '**/build/reports/junit.xml');
                }
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
                    tl.warning(tl.loc('NoTestResultsFound', testResultsFiles));
                }

                var tp = new tl.TestPublisher("JUnit");
                tp.publish(matchingTestResultsFiles, false, "", "", "", true);
            }
            
        }

        //--------------------------------------------------------
        // Package app to generate .ipa
        //--------------------------------------------------------
        if(tl.getBoolInput('packageApp', true) && sdk !== 'iphonesimulator') {
            var useXcrun: string = tl.getVariable('useXcrun');
            if(useXcrun) {
                useXcrun = useXcrun.toString().toLowerCase();
            }
            if (useXcrun === 'true' || useXctool || !ws || !scheme || xcodeVersion < 7) {
                // xcrun has been deprecated in Xcode 7 and higher
                // use xcrun to package apps if xcodeversion is < 7
                // or if workspace or scheme are not specified since we cannot create the archive
                tl.debug('Packaging apps.');
                var buildOutputPath : string = tl.resolve(outPath, 'build.sym');
                tl.debug('buildOutputPath: ' + buildOutputPath);
                var appFolders : string [] = tl.glob(buildOutputPath + '/**/*.app');
                if (appFolders) {
                    tl.debug(appFolders.length + ' apps found for packaging.');
                    var xcrunPath : string = tl.which('xcrun', true);
                    for(var i = 0; i < appFolders.length; i++) {
                        var app : string = appFolders.pop();
                        tl.debug('Packaging ' + app);
                        var ipa : string = app.substring(0, app.length-3) + 'ipa';
                        var xcr : ToolRunner = tl.tool(xcrunPath);
                        xcr.argIf(sdk, ['-sdk', sdk]);
                        xcr.arg(['PackageApplication', '-v', app, '-o', ipa]);
                        await xcr.exec();
                    }
                }
            }
            else {
                // use xcodebuild to create the app package for Xcode 7 and 8 if workspace is specified

                // create archive
                var xcodeArchive : ToolRunner = tl.tool(tl.which('xcodebuild', true));
                if (ws && tl.filePathSupplied('xcWorkspacePath')) {
                    xcodeArchive.arg('-workspace');
                    xcodeArchive.arg(ws);
                }
                xcodeArchive.argIf(scheme, ['-scheme', scheme]);
                xcodeArchive.arg('archive'); //archive action
                xcodeArchive.argIf(sdk, ['-sdk', sdk]);
                xcodeArchive.argIf(configuration, ['-configuration', configuration]);
                var archivePath : string = tl.getInput('archivePath');
                var archiveFolderRoot : string;
                if(!archivePath.endsWith('.xcarchive')) {
                    archiveFolderRoot = archivePath;
                    archivePath = tl.resolve(archivePath, scheme);
                } else {
                    //user specified a file path for archivePath
                    archiveFolderRoot = path.dirname(archivePath);
                }
                xcodeArchive.arg(['-archivePath', archivePath]);
                xcodeArchive.argIf(xcode_otherCodeSignFlags, xcode_otherCodeSignFlags);
                xcodeArchive.argIf(xcode_codeSignIdentity, xcode_codeSignIdentity);
                xcodeArchive.argIf(xcode_provProfile, xcode_provProfile);
                xcodeArchive.argIf(xcode_devTeam, xcode_devTeam);

                if(useXcpretty) {
                    var xcPrettyTool:ToolRunner = tl.tool(tl.which('xcpretty', true));
                    xcPrettyTool.arg('--no-color');
                    xcodeArchive.pipeExecOutputToTool(xcPrettyTool);
                }
                await xcodeArchive.exec();

                var archiveFolders : string [] = tl.glob(archiveFolderRoot + '/**/*.xcarchive');
                if (archiveFolders && archiveFolders.length > 0) {
                    tl.debug(archiveFolders.length + ' archives found for exporting.');

                    //export options plist
                    var exportOptions : string = tl.getInput('exportOptions');
                    var exportMethod: string;
                    var exportTeamId: string;
                    var exportOptionsPlist : string;

                    if(exportOptions === 'auto') {
                        // Automatically try to detect the export-method to use from the provisioning profile
                        // embedded in the .xcarchive file
                        var archiveToCheck : string = archiveFolders[0];
                        var embeddedProvProfile: string [] = tl.glob(archiveToCheck + '/**/embedded.mobileprovision');
                        if(embeddedProvProfile && embeddedProvProfile.length > 0) {
                            tl.debug('embedded prov profile = ' + embeddedProvProfile);
                            exportMethod = await sign.getProvisioningProfileType(embeddedProvProfile[0]);
                            tl.debug('Using export method = ' + exportMethod);
                            if(!exportMethod) {
                                tl.warning(tl.loc('ExportMethodNotIdentified'));
                            }
                        }
                    } else if(exportOptions === 'specify') {
                        exportMethod = tl.getInput('exportMethod', true);
                        exportTeamId = tl.getInput('exportTeamId');
                    } else if (exportOptions === 'plist') {
                        exportOptionsPlist = tl.getInput('exportOptionsPlist');
                        if(!tl.filePathSupplied('exportOptionsPlist') || !pathExistsAsFile(exportOptionsPlist)) {
                            throw tl.loc('ExportOptionsPlistInvalidFilePath', exportOptionsPlist);
                        }
                    }

                    if(exportMethod) {
                        // generate the plist file if we have an exportMethod set from exportOptions = auto or specify
                        var plist : string = tl.which('/usr/libexec/PlistBuddy', true);
                        exportOptionsPlist = '_XcodeTaskExportOptions.plist';
                        tl.tool(plist).arg(['-c', 'Clear', exportOptionsPlist]).execSync();
                        tl.tool(plist).arg(['-c', 'Add method string ' + exportMethod, exportOptionsPlist]).execSync();
                        if(exportTeamId) {
                            tl.tool(plist).arg(['-c', 'Add teamID string ' + exportTeamId, exportOptionsPlist]).execSync();
                        }
                    }

                    //export path
                    var exportPath : string = tl.getInput('exportPath');
                    if(!exportPath.endsWith('.ipa')) {
                        exportPath = tl.resolve(exportPath, '_XcodeTaskExport_' + scheme);
                    }
                    // delete if it already exists, otherwise export will fail
                    if(tl.exist(exportPath)) {
                        tl.rmRF(exportPath, false);
                    }

                    for(var i = 0; i < archiveFolders.length; i++) {
                        var archive : string = archiveFolders.pop();

                        //export the archive
                        var xcodeExport : ToolRunner = tl.tool(tl.which('xcodebuild', true));
                        xcodeExport.arg(['-exportArchive', '-archivePath', archive]);
                        xcodeExport.arg(['-exportPath', exportPath]);
                        xcodeExport.argIf(exportOptionsPlist, ['-exportOptionsPlist', exportOptionsPlist]);

                        if(useXcpretty) {
                            var xcPrettyTool:ToolRunner = tl.tool(tl.which('xcpretty', true));
                            xcPrettyTool.arg('--no-color');
                            xcodeExport.pipeExecOutputToTool(xcPrettyTool);
                        }
                        await xcodeExport.exec();
                    }
                }
            }

        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('XcodeSuccess'));
    }
    catch(err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        //clean up the temporary keychain, so it is not used to search for code signing identity in future builds
        if(keychainToDelete) {
            try {
                await sign.deleteKeychain(keychainToDelete);
            } catch(err) {
                tl.debug('Failed to delete temporary keychain. Error = ' + err);
                tl.warning(tl.loc('TempKeychainDeleteFailed', keychainToDelete));
            }
        }

        //delete provisioning profile if specified
        if(profileToDelete) {
            try {
                await sign.deleteProvisioningProfile(profileToDelete);
            } catch(err) {
                tl.debug('Failed to delete provisioning profile. Error = ' + err);
                tl.warning(tl.loc('ProvProfileDeleteFailed', profileToDelete));
            }
        }
    }
}

function pathExistsAsFile(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}

run();
