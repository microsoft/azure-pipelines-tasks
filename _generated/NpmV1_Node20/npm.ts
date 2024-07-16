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

    await _logNpmStartupVariables(packagingLocation);

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

async function _logNpmStartupVariables(packagingLocation: pkgLocationUtils.PackagingLocation) {
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

        // Log the NPM registries
        const command = tl.getInput(NpmTaskInput.Command) || null;
        let npmRegistriesAry: INpmRegistry[];
        const registryUrlAry = [];
        switch (command) {
            case NpmCommand.Install:
            case NpmCommand.Custom:
                npmRegistriesAry = await npmCustom.getCustomRegistries(packagingLocation);
                break;
            case NpmCommand.Publish:
                npmRegistriesAry = [await npmPublish.getPublishRegistry(packagingLocation)];
                break;
        }
        for (const registry of npmRegistriesAry) {
            registryUrlAry.push(registry.url);
        }

        const npmTelem = {
            'command': command,
            'verbose': tl.getInput(NpmTaskInput.Verbose) || null,
            'customRegistry': tl.getInput(NpmTaskInput.CustomRegistry) || null,
            'customFeed': tl.getInput(NpmTaskInput.CustomFeed) || null,
            'customEndpoint': tl.getInput(NpmTaskInput.CustomEndpoint) || null,
            'publishRegistry': tl.getInput(NpmTaskInput.PublishRegistry) || null,
            'publishFeed': tl.getInput(NpmTaskInput.PublishFeed) || null,
            'publishEndpoint': tl.getInput(NpmTaskInput.PublishEndpoint) || null,
            'npmVersion': version,
            'registries': registryUrlAry
        };

        telemetry.emitTelemetry('Packaging', 'npm', npmTelem);
    } catch (err) {
        tl.debug(`Unable to log NPM task telemetry. Err:( ${err} )`);
    }
}

main().catch(error => {
    tl.rmRF(util.getTempPath());
    tl.setResult(tl.TaskResult.Failed, error);
});
