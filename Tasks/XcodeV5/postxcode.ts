import os = require('os');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');
import utils = require('./xcodeutils');

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Check platform is macOS since demands are not evaluated on Hosted pools
        if (os.platform() !== 'darwin') {
            console.log(tl.loc('XcodeRequiresMac'));
        } else {
            //--------------------------------------------------------
            // Test publishing - publish even if tests fail
            //--------------------------------------------------------
            let testResultsFiles: string;
            const publishResults: boolean = tl.getBoolInput('publishJUnitResults', false);
            const useXcpretty: boolean = tl.getBoolInput('useXcpretty', false);
            const workingDir: string = tl.getPathInput('cwd');
            
            if (publishResults) {
                if (!useXcpretty) {
                    throw tl.loc('UseXcprettyForTestPublishing');
                } else if (useXcpretty && !tl.which('xcpretty')) {
                    throw tl.loc("XcprettyNotInstalled");
                }
                else {
                    // xcpretty is enabled and installed
                    testResultsFiles = tl.resolve(workingDir, '**/build/reports/junit.xml');

                    if (testResultsFiles && 0 !== testResultsFiles.length) {
                        //check for pattern in testResultsFiles
                        let matchingTestResultsFiles: string[];
                        if (testResultsFiles.indexOf('*') >= 0) {
                            tl.debug('Pattern found in testResultsFiles parameter');
                            matchingTestResultsFiles = tl.findMatch(workingDir, testResultsFiles, 
                                { allowBrokenSymbolicLinks: false, followSpecifiedSymbolicLink: false, followSymbolicLinks: false }, 
                                { matchBase: true, nocase: true });
                        }
                        else {
                            tl.debug('No pattern found in testResultsFiles parameter');
                            matchingTestResultsFiles = [testResultsFiles];
                        }

                        if (!matchingTestResultsFiles) {
                            tl.warning(tl.loc('NoTestResultsFound', testResultsFiles));
                        } else {
                            const TESTRUN_SYSTEM = "VSTS - xcode";
                            const tp = new tl.TestPublisher("JUnit");
                            tp.publish(matchingTestResultsFiles, false, "", "", "", true, TESTRUN_SYSTEM);
                        }
                    }
                }
            }

            //clean up the temporary keychain, so it is not used to search for code signing identity in future builds
            var keychainToDelete = utils.getTaskState('XCODE_KEYCHAIN_TO_DELETE')
            if (keychainToDelete) {
                try {
                    await sign.deleteKeychain(keychainToDelete);
                } catch (err) {
                    tl.debug('Failed to delete temporary keychain. Error = ' + err);
                    tl.warning(tl.loc('TempKeychainDeleteFailed', keychainToDelete));
                }
            }

            //delete provisioning profile if specified
            var profileToDelete = utils.getTaskState('XCODE_PROFILE_TO_DELETE');
            if (profileToDelete) {
                try {
                    await sign.deleteProvisioningProfile(profileToDelete);
                } catch (err) {
                    tl.debug('Failed to delete provisioning profile. Error = ' + err);
                    tl.warning(tl.loc('ProvProfileDeleteFailed', profileToDelete));
                }
            }

            //upload detailed logs from xcodebuild if using xcpretty
            utils.uploadLogFile(utils.getTaskState('XCODEBUILD_LOG'));
            utils.uploadLogFile(utils.getTaskState('XCODEBUILD_ARCHIVE_LOG'));
            utils.uploadLogFile(utils.getTaskState('XCODEBUILD_EXPORT_LOG'));
        }
    } catch (err) {
        tl.warning(err);
    }
}

run();