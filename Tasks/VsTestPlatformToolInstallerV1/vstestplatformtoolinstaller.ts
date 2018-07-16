import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';
import { TaskResult } from 'vsts-task-lib/task';
import { NugetFeedInstaller } from './nugetfeedinstaller';
import { async } from 'q';

const consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

// First function to be invoke starting the installation
async function startInstaller() {
    try {
        const osPlat: string = os.platform();
        const packageSource = constants.defaultPackageSource;
        consolidatedCiData.operatingSystem = osPlat;
        consolidatedCiData.result = constants.installationStatusFailed;
        const networkSharePath = tl.getInput(constants.netShare, false);
        const username = tl.getInput(constants.username, false);
        const password = tl.getInput(constants.password, false);

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

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

        consolidatedCiData.packageFeedSelectorInput = packageFeedSelectorInput;

        tl.debug(`Selected package feed: ${packageFeedSelectorInput}`);
        switch (packageFeedSelectorInput.toLowerCase()) {

            case 'nugetorg':
                await new NugetFeedInstaller(consolidatedCiData)
                    .getVsTestPlatformToolFromSpecifiedFeed(packageSource, testPlatformVersion, versionSelectorInput, null);
                break;

            case 'customfeed':
                await new NugetFeedInstaller(consolidatedCiData)
                .getVsTestPlatformToolFromCustomFeed(packageSource, versionSelectorInput, testPlatformVersion, username, password);
            break;

            case 'netshare':
                await getVsTestPlatformToolFromNetworkShare(netSharePath);
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
    consolidatedCiData.executionStartTime = perf();
    startInstaller();
} finally {
    consolidatedCiData.executionEndTime = perf();
    ci.publishEvent('vstestToolInstallerConsolidatedCiEvent', consolidatedCiData);
}