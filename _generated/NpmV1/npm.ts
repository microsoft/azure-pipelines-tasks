import * as path from 'path';

import {IExecSyncResult} from 'azure-pipelines-task-lib/toolrunner';
import * as tl from 'azure-pipelines-task-lib/task';

import { NpmCommand, NpmTaskInput } from './constants';
import * as npmCustom from './npmcustom';
import * as npmPublish from './npmpublish';
import { INpmRegistry } from 'azure-pipelines-tasks-packaging-common/npm/npmregistry';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
    } catch (error) {
        tl.debug('Unable to get packaging URIs');
        util.logError(error);
        throw error;
    }
    const forcedUrl = tl.getVariable('Npm.PackagingCollectionUrl');
    if (forcedUrl) {
        packagingLocation.DefaultPackagingUri = forcedUrl;
        packagingLocation.PackagingUris.push(forcedUrl);
    }


    const command = tl.getInput(NpmTaskInput.Command) || null;
    switch (command) {
        case NpmCommand.Install:
            return npmCustom.run(packagingLocation, NpmCommand.Install);
        case NpmCommand.ContinuousIntegration:
            return npmCustom.run(packagingLocation, NpmCommand.ContinuousIntegration);
        case NpmCommand.Publish:
            return npmPublish.run(packagingLocation);
        case NpmCommand.Custom:
            return npmCustom.run(packagingLocation);
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc('UnknownCommand', command));
            return;
    }
}

main().catch(error => {
    tl.rmRF(util.getTempPath());
    tl.setResult(tl.TaskResult.Failed, error);
});
