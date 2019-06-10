import * as path from 'path';

import {IExecSyncResult} from 'azure-pipelines-task-lib/toolrunner';
import * as tl from 'azure-pipelines-task-lib/task';

import { NpmCommand, NpmTaskInput } from './constants';
import * as npmCustom from './npmcustom';
import * as npmPublish from './npmpublish';
import { INpmRegistry } from 'packaging-common/npm/npmregistry';
import * as telemetry from 'utility-common/telemetry';
import * as util from 'packaging-common/util';
import * as pkgLocationUtils from 'packaging-common/locationUtilities';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
    } catch (error) {
        tl.debug('Unable to get packaging URIs, using default collection URI');
        tl.debug(JSON.stringify(error));
        const collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
        packagingLocation = {
            PackagingUris: [collectionUrl],
            DefaultPackagingUri: collectionUrl
        };
    }
    const forcedUrl = tl.getVariable('Npm.PackagingCollectionUrl');
    if (forcedUrl) {
        packagingLocation.DefaultPackagingUri = forcedUrl;
        packagingLocation.PackagingUris.push(forcedUrl);
    }

    await _logNpmStartupVariables(packagingLocation);

    const command = tl.getInput(NpmTaskInput.Command);
    switch (command) {
        case NpmCommand.Install:
            return npmCustom.run(packagingLocation, NpmCommand.Install);
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
        const command = tl.getInput(NpmTaskInput.Command);
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
            'verbose': tl.getInput(NpmTaskInput.Verbose),
            'customRegistry': tl.getInput(NpmTaskInput.CustomRegistry),
            'customFeed': tl.getInput(NpmTaskInput.CustomFeed),
            'customEndpoint': tl.getInput(NpmTaskInput.CustomEndpoint),
            'publishRegistry': tl.getInput(NpmTaskInput.PublishRegistry),
            'publishFeed': tl.getInput(NpmTaskInput.PublishFeed),
            'publishEndpoint': tl.getInput(NpmTaskInput.PublishEndpoint),
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
