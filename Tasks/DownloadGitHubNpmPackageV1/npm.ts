import * as path from 'path';

import {IExecSyncResult} from 'azure-pipelines-task-lib/toolrunner';
import * as tl from 'azure-pipelines-task-lib/task';

import * as npminstall from './npminstall';
import * as util from 'azure-pipelines-tasks-packaging-common/util';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    await _logNpmStartupVariables();
    npminstall.run();
}

async function _logNpmStartupVariables() {
    try {
        // Log the NPM version
        let version: string;
        try {
            const syncResult: IExecSyncResult = tl.execSync('npm', '--version');
            if (syncResult.stdout) {
                version = syncResult.stdout.trim();
            }
        } catch (err) {
            tl.debug(`Unable to get NPM config info. Err:( ${err} )`);
        }
    } catch (err) {
        tl.debug(`Unable to log NPM task telemetry. Err:( ${err} )`);
    }
}

main().catch(error => {
    tl.rmRF(util.getTempPath());
    tl.setResult(tl.TaskResult.Failed, error);
});