import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as os from 'os';
import * as path from 'path';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import { TaskResult } from 'vsts-task-lib/task';
import { NugetFeedInstaller } from './nugetfeedinstaller';
import { NetworkShareInstaller } from './networkshareinstaller';
import { async } from 'q';

const consolidatedCiData: { [key: string]: any; } = <{ [key: string]: any; }>{};

// First function to be invoke starting the installation
async function startInstaller() {
    try {

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        const osPlat: string = os.platform();
        consolidatedCiData.operatingSystem = osPlat;
        consolidatedCiData.result = constants.installationStatusFailed;

        // Fail the task if os is not windows
        if (osPlat !== 'win32') {
            consolidatedCiData.failureReason = constants.unsupportedOS;
            tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
            return;
        }

        // Read task inputs
        const packageFeedSelectorInput = tl.getInput(constants.packageFeedSelector, true);
        const versionSelectorInput = tl.getInput(constants.versionSelector, false);
        const testPlatformVersion = tl.getInput(constants.testPlatformVersion, false);
        const networkSharePath = tl.getInput(constants.netShare, false);
        const username = tl.getInput(constants.username, false);
        const password = tl.getInput(constants.password, false);
        const packageSource = constants.defaultPackageSource;

        consolidatedCiData.packageFeedSelectorInput = packageFeedSelectorInput;

        tl.debug(`Selected package feed: ${packageFeedSelectorInput}`);
        switch (packageFeedSelectorInput.toLowerCase()) {

            case 'nugetorg':
                tl.debug('Going via nuget org download flow.');
                await new NugetFeedInstaller(consolidatedCiData)
                    .installVsTestPlatformToolFromSpecifiedFeed(packageSource, testPlatformVersion, versionSelectorInput, null);
                break;

            case 'customfeed':
                tl.debug('Going via custom feed download flow.');
                await new NugetFeedInstaller(consolidatedCiData)
                    .installVsTestPlatformToolFromCustomFeed(packageSource, versionSelectorInput, testPlatformVersion, username, password);
            break;

            case 'netshare':
                tl.debug('Going via net share copy flow.');
                await new NetworkShareInstaller(consolidatedCiData).installVsTestPlatformToolFromNetworkShare(networkSharePath);
                break;
        }

    } catch (error) {
        ci.publishEvent('Completed', { isSetupSuccessful: 'false' } );
        tl.setResult(tl.TaskResult.Failed, error);
        return;
    }

    consolidatedCiData.result = constants.installationStatusSucceeded;
    ci.publishEvent('Completed', { isSetupSuccessful: 'true', startTime: consolidatedCiData.executionStartTime, endTime: perf() } );
}

// Execution start
try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const executionStartTime = perf();
    startInstaller();
} finally {
    consolidatedCiData.executionEndTime = perf();
    ci.publishEvent('vstestToolInstallerConsolidatedCiEvent', consolidatedCiData);
}