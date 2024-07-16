import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import * as path from 'path';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import { NugetFeedInstaller } from './nugetfeedinstaller';
import { NetworkShareInstaller } from './networkshareinstaller';
let startTime: number;

// First function to be invoke starting the installation
async function startInstaller() {
    try {

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        const osPlat: string = os.platform();
        ci.addToConsolidatedCi('operatingSystem', osPlat);
        ci.addToConsolidatedCi('result', constants.installationStatusFailed);

        // Fail the task if os is not windows
        if (osPlat !== 'win32') {
            ci.addToConsolidatedCi('failureReason', constants.unsupportedOS);
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

        ci.addToConsolidatedCi('packageFeedSelectorInput', packageFeedSelectorInput);

        tl.debug(`Selected package feed: ${packageFeedSelectorInput}`);
        switch (packageFeedSelectorInput.toLowerCase()) {

            case 'nugetorg':
                tl.debug('Going via nuget org download flow.');
                await new NugetFeedInstaller()
                    .installVsTestPlatformToolFromSpecifiedFeed(packageSource, testPlatformVersion, versionSelectorInput, null);
                break;

            case 'customfeed':
                tl.debug('Going via custom feed download flow.');
                await new NugetFeedInstaller()
                    .installVsTestPlatformToolFromCustomFeed(packageSource, versionSelectorInput, testPlatformVersion, username, password);
            break;

            case 'netshare':
                tl.debug('Going via net share copy flow.');
                await new NetworkShareInstaller().installVsTestPlatformToolFromNetworkShare(networkSharePath);
                break;
        }

    } catch (error) {
        ci.publishEvent('Completed', { isSetupSuccessful: 'false' } );
        tl.setResult(tl.TaskResult.Failed, error);
        return;
    }

    ci.addToConsolidatedCi('result', constants.installationStatusSucceeded);
}

// Execution start
tl.setResourcePath(path.join(__dirname, 'task.json'));
startTime = perf();
startInstaller().then(() => {
    ci.addToConsolidatedCi('executionTime', perf() - startTime);
    ci.fireConsolidatedCi();
}).catch(() => {
    ci.addToConsolidatedCi('executionTime', perf() - startTime);
    ci.fireConsolidatedCi();
});