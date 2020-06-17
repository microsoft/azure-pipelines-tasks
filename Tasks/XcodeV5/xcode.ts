import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as sign from 'ios-signing-common/ios-signing-common';
import * as utils from './xcodeutils';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

async function run() {
    const telemetryData: { [key: string]: any; } = {};

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //--------------------------------------------------------
        // Tooling
        //--------------------------------------------------------

        const xcodeVersionSelection: string = tl.getInput('xcodeVersion', true);
        telemetryData.xcodeVersionSelection = xcodeVersionSelection;

        if (xcodeVersionSelection === 'specifyPath') {
            const devDir = tl.getInput('xcodeDeveloperDir', true);
            tl.setVariable('DEVELOPER_DIR', devDir);
        } else if (xcodeVersionSelection !== 'default') {
            // resolve the developer dir for a version like "8" or "9".
            const devDir = utils.findDeveloperDir(xcodeVersionSelection);
            tl.setVariable('DEVELOPER_DIR', devDir);
        }

        const tool: string = tl.which('xcodebuild', true);
        tl.debug('Tool selected: ' + tool);

        const workingDir: string = tl.getPathInput('cwd');
        tl.cd(workingDir);

        //--------------------------------------------------------
        // Xcode args
        //--------------------------------------------------------
        let ws: string = tl.getPathInput('xcWorkspacePath', false, false);
        if (tl.filePathSupplied('xcWorkspacePath')) {
            const workspaceMatches = tl.findMatch(workingDir, ws, { allowBrokenSymbolicLinks: false, followSpecifiedSymbolicLink: false, followSymbolicLinks: false });
            tl.debug(`Found ${workspaceMatches.length} workspaces matching.`);

            if (workspaceMatches.length > 0) {
                ws = workspaceMatches[0];
                if (workspaceMatches.length > 1) {
                    tl.warning(tl.loc('MultipleWorkspacesFound', ws));
                }
            } else {
                throw new Error(tl.loc('WorkspaceDoesNotExist', ws));
            }
        }

        let isProject = false;
        if (ws && ws.trim().toLowerCase().endsWith('.xcodeproj')) {
            isProject = true;
        }

        let scheme: string = tl.getInput('scheme', false);

        // If we have a workspace argument but no scheme, see if there's
        // single shared scheme we can use.
        if (!scheme && !isProject && ws && tl.filePathSupplied('xcWorkspacePath')) {
            try {
                const schemes: string[] = await utils.getWorkspaceSchemes(tool, ws);

                if (schemes.length > 1) {
                    tl.warning(tl.loc('MultipleSchemesFound'));
                } else if (schemes.length === 0) {
                    tl.warning(tl.loc('NoSchemeFound'));
                } else {
                    scheme = schemes[0];
                    console.log(tl.loc('SchemeSelected', scheme));
                }
            } catch (err) {
                tl.warning(tl.loc('FailedToFindScheme'));
            }
        }

        let destinations: string[];

        let platform: string = tl.getInput('destinationPlatformOption', false);
        if (platform === 'custom') {
            // Read the custom platform from the text input.
            platform = tl.getInput('destinationPlatform', false);
        }

        if (platform === 'macOS') {
            destinations = ['platform=macOS'];
        } else if (platform && platform !== 'default') {
            // To be yaml friendly, destinationTypeOption is optional and we default to simulators.
            const destinationType: string = tl.getInput('destinationTypeOption', false);
            const targetingSimulators: boolean = destinationType !== 'devices';

            let devices: string[];
            if (targetingSimulators) {
                // Only one simulator for now.
                devices = [tl.getInput('destinationSimulators')];
            } else {
                // Only one device for now.
                devices = [tl.getInput('destinationDevices')];
            }

            destinations = utils.buildDestinationArgs(platform, devices, targetingSimulators);
        }

        const sdk: string = tl.getInput('sdk', false);
        const configuration: string = tl.getInput('configuration', false);
        let useXcpretty: boolean = tl.getBoolInput('useXcpretty', false);
        const actions: string[] = tl.getDelimitedInput('actions', ' ', true);
        const packageApp: boolean = tl.getBoolInput('packageApp', true);
        const args: string = tl.getInput('args', false);

        telemetryData.actions = actions;
        telemetryData.packageApp = packageApp;

        //--------------------------------------------------------
        // Exec Tools
        //--------------------------------------------------------

        // --- Xcode Version ---
        const xcv: ToolRunner = tl.tool(tool);
        xcv.arg('-version');
        let xcodeMajorVersion: number = 0;
        xcv.on('stdout', (data) => {
            const match = data.toString().trim().match(/Xcode (.+)/g);
            tl.debug('match = ' + match);
            if (match) {
                const versionString = match.toString().replace('Xcode', '').trim();
                const majorVersion: number = parseInt(versionString);
                tl.debug('majorVersion = ' + majorVersion);
                telemetryData.xcodeVersion = versionString;

                if (!isNaN(majorVersion)) {
                    xcodeMajorVersion = majorVersion;
                }
            }
        });

        await xcv.exec();
        tl.debug('xcodeMajorVersion = ' + xcodeMajorVersion);

        // --- Xcode build arguments ---
        const xcb: ToolRunner = tl.tool(tool);
        xcb.argIf(sdk, ['-sdk', sdk]);
        xcb.argIf(configuration, ['-configuration', configuration]);
        if (ws && tl.filePathSupplied('xcWorkspacePath')) {
            xcb.argIf(isProject, '-project');
            xcb.argIf(!isProject, '-workspace');
            xcb.arg(ws);
        }
        xcb.argIf(scheme, ['-scheme', scheme]);
        // Add a -destination argument for each device and simulator.
        if (destinations) {
            destinations.forEach(destination => {
                xcb.arg(['-destination', destination]);
            });
        }
        xcb.arg(actions);
        if (args) {
            xcb.line(args);
        }

        //--------------------------------------------------------
        // iOS signing and provisioning
        //--------------------------------------------------------
        const signingOption: string = tl.getInput('signingOption', true);
        const appSigning: utils.ICodeSigning = {};

        telemetryData.signingOption = signingOption;

        if (signingOption === 'nosign') {
            appSigning.codeSigningAllowed = 'CODE_SIGNING_ALLOWED=NO';
        } else if (signingOption === 'manual') {
            appSigning.codeSignStyle = 'CODE_SIGN_STYLE=Manual';

            const signIdentity: string = tl.getInput('signingIdentity');
            if (signIdentity) {
                appSigning.codeSignIdentity = `CODE_SIGN_IDENTITY=${signIdentity}`;
            }

            let provProfileUUID: string = tl.getInput('provisioningProfileUuid');
            let provProfileName: string = tl.getInput('provisioningProfileName');

            if (!provProfileUUID) {
                provProfileUUID = '';
            }

            if (!provProfileName) {
                provProfileName = '';
            }

            // PROVISIONING_PROFILE_SPECIFIER takes predence over PROVISIONING_PROFILE,
            // so it's important to pass it to Xcode even if it's empty. That way Xcode
            // will ignore any specifier in the project file and honor the specifier
            // or uuid we passed on the commandline. If the user wants to use the specifier
            // in the project file, they should choose the "Project Defaults" signing style.
            appSigning.provProfile = `PROVISIONING_PROFILE=${provProfileUUID}`;
            appSigning.provProfileSpecifier = `PROVISIONING_PROFILE_SPECIFIER=${provProfileName}`;
        } else if (signingOption === 'auto') {
            appSigning.codeSignStyle = 'CODE_SIGN_STYLE=Automatic';

            const teamId: string = tl.getInput('teamId');
            if (teamId) {
                appSigning.devTeam = `DEVELOPMENT_TEAM=${teamId}`;
            }
        }

        xcb.argIf(appSigning.codeSigningAllowed, appSigning.codeSigningAllowed);
        xcb.argIf(appSigning.codeSignStyle, appSigning.codeSignStyle);
        xcb.argIf(appSigning.codeSignIdentity, appSigning.codeSignIdentity);
        xcb.argIf(appSigning.provProfile, appSigning.provProfile);
        xcb.argIf(appSigning.provProfileSpecifier, appSigning.provProfileSpecifier);
        xcb.argIf(appSigning.devTeam, appSigning.devTeam);

        //--- Enable Xcpretty formatting ---
        if (useXcpretty && !tl.which('xcpretty')) {
            // user wants to enable xcpretty but it is not installed, fallback to xcodebuild raw output
            useXcpretty = false;
            tl.warning(tl.loc('XcprettyNotInstalled'));
        }

        if (useXcpretty) {
            const xcPrettyPath: string = tl.which('xcpretty', true);
            const xcPrettyTool: ToolRunner = tl.tool(xcPrettyPath);
            xcPrettyTool.arg(['-r', 'junit', '--no-color']);

            const logFile: string = utils.getUniqueLogFileName('xcodebuild');
            xcb.pipeExecOutputToTool(xcPrettyTool, logFile);
            utils.setTaskState('XCODEBUILD_LOG', logFile);
        }

        //--- Xcode Build ---
        let buildOnlyDeviceErrorFound: boolean;
        xcb.on('errline', (line: string) => {
            if (!buildOnlyDeviceErrorFound && line.includes('build only device cannot be used to run this target')) {
                buildOnlyDeviceErrorFound = true;
            }
        });

        try {
            await xcb.exec();
        } catch (err) {
            if (buildOnlyDeviceErrorFound) {
                // Tell the user they need to change Destination platform to fix this build error.
                tl.warning(tl.loc('NoDestinationPlatformWarning'));
            }
            throw err;
        }

        //--------------------------------------------------------
        // Package app to generate .ipa
        //--------------------------------------------------------

        if (packageApp && sdk !== 'iphonesimulator') {
            // use xcodebuild to create the app package
            if (!scheme) {
                throw new Error(tl.loc('SchemeRequiredForArchive'));
            }
            if (!ws || !tl.filePathSupplied('xcWorkspacePath')) {
                throw new Error(tl.loc('WorkspaceOrProjectRequiredForArchive'));
            }

            // create archive
            const xcodeArchive: ToolRunner = tl.tool(tl.which('xcodebuild', true));
            if (ws && tl.filePathSupplied('xcWorkspacePath')) {
                xcodeArchive.argIf(isProject, '-project');
                xcodeArchive.argIf(!isProject, '-workspace');
                xcodeArchive.arg(ws);
            }
            xcodeArchive.argIf(scheme, ['-scheme', scheme]);
            xcodeArchive.arg('archive'); //archive action
            xcodeArchive.argIf(sdk, ['-sdk', sdk]);
            xcodeArchive.argIf(configuration, ['-configuration', configuration]);
            let archivePath: string = tl.getInput('archivePath');
            let archiveFolderRoot: string;
            if (!archivePath.endsWith('.xcarchive')) {
                archiveFolderRoot = archivePath;
                archivePath = tl.resolve(archivePath, scheme);
            } else {
                //user specified a file path for archivePath
                archiveFolderRoot = path.dirname(archivePath);
            }
            xcodeArchive.arg(['-archivePath', archivePath]);
            xcodeArchive.argIf(appSigning.otherCodeSignFlags, appSigning.otherCodeSignFlags);
            xcodeArchive.argIf(appSigning.codeSigningAllowed, appSigning.codeSigningAllowed);
            xcodeArchive.argIf(appSigning.codeSignStyle, appSigning.codeSignStyle);
            xcodeArchive.argIf(appSigning.codeSignIdentity, appSigning.codeSignIdentity);
            xcodeArchive.argIf(appSigning.provProfile, appSigning.provProfile);
            xcodeArchive.argIf(appSigning.provProfileSpecifier, appSigning.provProfileSpecifier);
            xcodeArchive.argIf(appSigning.devTeam, appSigning.devTeam);
            if (args) {
                xcodeArchive.line(args);
            }

            if (useXcpretty) {
                const xcPrettyTool: ToolRunner = tl.tool(tl.which('xcpretty', true));
                xcPrettyTool.arg('--no-color');
                const logFile: string = utils.getUniqueLogFileName('xcodebuild_archive');
                xcodeArchive.pipeExecOutputToTool(xcPrettyTool, logFile);
                utils.setTaskState('XCODEBUILD_ARCHIVE_LOG', logFile);
            }
            await xcodeArchive.exec();

            const archiveFolders: string[] = tl.findMatch(archiveFolderRoot, '**/*.xcarchive', { allowBrokenSymbolicLinks: false, followSpecifiedSymbolicLink: false, followSymbolicLinks: false });
            if (archiveFolders && archiveFolders.length > 0) {
                tl.debug(archiveFolders.length + ' archives found for exporting.');

                //export options plist
                const exportOptions: string = tl.getInput('exportOptions');
                let exportMethod: string;
                let exportTeamId: string;
                let exportOptionsPlist: string;
                const archiveToCheck: string = archiveFolders[0];
                let macOSEmbeddedProfilesFound: boolean;

                telemetryData.exportOptions = exportOptions;

                // iOS provisioning profiles use the .mobileprovision suffix. macOS profiles have the .provisionprofile suffix.
                let embeddedProvProfiles: string[] = tl.findMatch(archiveToCheck, '**/embedded.mobileprovision', { allowBrokenSymbolicLinks: false, followSpecifiedSymbolicLink: false, followSymbolicLinks: false });

                if (embeddedProvProfiles && embeddedProvProfiles.length > 0) {
                    tl.debug(`${embeddedProvProfiles.length} iOS embedded.mobileprovision file(s) found.`);
                } else {
                    embeddedProvProfiles = tl.findMatch(archiveToCheck, '**/embedded.provisionprofile', { allowBrokenSymbolicLinks: false, followSpecifiedSymbolicLink: false, followSymbolicLinks: false });

                    if (embeddedProvProfiles && embeddedProvProfiles.length > 0) {
                        tl.debug(`${embeddedProvProfiles.length} macOS embedded.provisionprofile file(s) found.`);
                        macOSEmbeddedProfilesFound = true;
                    }
                }

                if (exportOptions === 'auto') {
                    // Automatically try to detect the export-method to use from the provisioning profile
                    // embedded in the .xcarchive file
                    if (embeddedProvProfiles && embeddedProvProfiles.length > 0) {
                        tl.debug('embedded prov profile = ' + embeddedProvProfiles[0]);

                        if (macOSEmbeddedProfilesFound) {
                            exportMethod = await sign.getmacOSProvisioningProfileType(embeddedProvProfiles[0]);
                        } else {
                            exportMethod = await sign.getiOSProvisioningProfileType(embeddedProvProfiles[0]);
                        }

                        tl.debug('Using export method = ' + exportMethod);
                    }

                    // If you create a simple macOS app with automatic signing and no entitlements, it won't have an embedded profile.
                    // And export for that app will work with an empty exportOptionsPlist.
                    if (!exportMethod && sdk && sdk !== 'macosx') {
                        tl.warning(tl.loc('ExportMethodNotIdentified'));
                    }
                } else if (exportOptions === 'specify') {
                    exportMethod = tl.getInput('exportMethod', true);
                    exportTeamId = tl.getInput('exportTeamId');
                } else if (exportOptions === 'plist') {
                    exportOptionsPlist = tl.getInput('exportOptionsPlist');
                    if (!tl.filePathSupplied('exportOptionsPlist') || !utils.pathExistsAsFile(exportOptionsPlist)) {
                        throw new Error(tl.loc('ExportOptionsPlistInvalidFilePath', exportOptionsPlist));
                    }
                }

                if (exportOptions !== 'plist') {
                    // As long as the user didn't provide a plist, start with an empty one.
                    // Xcode 7 warns "-exportArchive without -exportOptionsPlist is deprecated"
                    // Xcode 8+ will error if a plist isn't provided.
                    const plist: string = tl.which('/usr/libexec/PlistBuddy', true);

                    exportOptionsPlist = '_XcodeTaskExportOptions.plist';
                    tl.tool(plist).arg(['-c', 'Clear', exportOptionsPlist]).execSync();

                    // Add the teamId if provided.
                    if (exportTeamId) {
                        tl.tool(plist).arg(['-c', 'Add teamID string ' + exportTeamId, exportOptionsPlist]).execSync();
                    }

                    // Add the export method if provided or determined above.
                    if (exportMethod) {
                        tl.tool(plist).arg(['-c', 'Add method string ' + exportMethod, exportOptionsPlist]).execSync();
                    }

                    // For auto export, conditionally add entitlements, signingStyle and provisioning profiles.
                    if (xcodeMajorVersion >= 9 && exportOptions === 'auto') {
                        // Propagate any iCloud entitlement.
                        if (embeddedProvProfiles && embeddedProvProfiles.length > 0) {
                            const cloudEntitlement = await sign.getCloudEntitlement(embeddedProvProfiles[0], exportMethod);
                            if (cloudEntitlement) {
                                tl.debug('Adding cloud entitlement');
                                tl.tool(plist).arg(['-c', `Add iCloudContainerEnvironment string ${cloudEntitlement}`, exportOptionsPlist]).execSync();
                            }
                        }

                        let signingOptionForExport = signingOption;

                        // If we're using the project defaults, scan the pbxProject file for the type of signing being used.
                        if (signingOptionForExport === 'default') {
                            signingOptionForExport = await utils.getProvisioningStyle(ws);

                            if (!signingOptionForExport) {
                                tl.warning(tl.loc('CantDetermineProvisioningStyle'));
                            }
                        }

                        if (signingOptionForExport === 'manual') {
                            // Xcode 9 manual signing, set code sign style = manual
                            tl.tool(plist).arg(['-c', 'Add signingStyle string ' + 'manual', exportOptionsPlist]).execSync();

                            // add provisioning profiles to the exportOptions plist
                            // find bundle Id from Info.plist and prov profile name from the embedded profile in each .app package
                            tl.tool(plist).arg(['-c', 'Add provisioningProfiles dict', exportOptionsPlist]).execSync();

                            for (let i = 0; i < embeddedProvProfiles.length; i++) {
                                const embeddedProvProfile: string = embeddedProvProfiles[i];
                                const profileName: string = await sign.getProvisioningProfileName(embeddedProvProfile);
                                tl.debug('embedded provisioning profile = ' + embeddedProvProfile + ', profile name = ' + profileName);

                                const embeddedInfoPlist: string = tl.resolve(path.dirname(embeddedProvProfile), 'Info.plist');
                                const bundleId: string = await sign.getBundleIdFromPlist(embeddedInfoPlist);
                                tl.debug('embeddedInfoPlist path = ' + embeddedInfoPlist + ', bundle identifier = ' + bundleId);

                                if (!profileName || !bundleId) {
                                    throw new Error(tl.loc('FailedToGenerateExportOptionsPlist'));
                                }

                                tl.tool(plist).arg(['-c', 'Add provisioningProfiles:' + bundleId + ' string ' + profileName, exportOptionsPlist]).execSync();
                            }
                        }
                    }
                }

                //export path
                const exportPath: string = tl.getInput('exportPath');

                for (let i = 0; i < archiveFolders.length; i++) {
                    const archive: string = archiveFolders.pop();

                    //export the archive
                    const xcodeExport: ToolRunner = tl.tool(tl.which('xcodebuild', true));
                    xcodeExport.arg(['-exportArchive', '-archivePath', archive]);
                    xcodeExport.arg(['-exportPath', exportPath]);
                    xcodeExport.argIf(exportOptionsPlist, ['-exportOptionsPlist', exportOptionsPlist]);
                    const exportArgs: string = tl.getInput('exportArgs');
                    xcodeExport.argIf(exportArgs, exportArgs);

                    if (useXcpretty) {
                        const xcPrettyTool: ToolRunner = tl.tool(tl.which('xcpretty', true));
                        xcPrettyTool.arg('--no-color');
                        const logFile: string = utils.getUniqueLogFileName('xcodebuild_export');
                        xcodeExport.pipeExecOutputToTool(xcPrettyTool, logFile);
                        utils.setTaskState('XCODEBUILD_EXPORT_LOG', logFile);
                    }
                    await xcodeExport.exec();
                }
            }
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('XcodeSuccess'));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
    finally {
        // Publish telemetry
        utils.emitTelemetry('TaskHub', 'Xcode', telemetryData);
    }
}

run();
