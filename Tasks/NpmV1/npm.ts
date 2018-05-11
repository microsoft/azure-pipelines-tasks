import * as path from 'path';
import * as url from 'url';

import {IExecSyncResult} from "vsts-task-lib/toolrunner";
import * as tl from 'vsts-task-lib/task';
import * as vsts from 'vso-node-api/WebApi';
import * as Q from 'q';

import { NpmCommand, NpmTaskInput, RegistryLocation } from './constants';
import * as npmCustom from './npmcustom';
import * as npmPublish from './npmpublish';
import { GetRegistries, NormalizeRegistry } from 'npm-common/npmrcparser';
import { INpmRegistry, NpmRegistry } from 'npm-common/npmregistry';
import * as telemetry from 'utility-common/telemetry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'npm-common/util';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    await _logNpmStartupVariables();

    const command = tl.getInput(NpmTaskInput.Command);
    switch (command) {
        case NpmCommand.Install:
            return npmCustom.run(NpmCommand.Install);
        case NpmCommand.Publish:
            return npmPublish.run();
        case NpmCommand.Custom:
            return npmCustom.run();
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc('UnknownCommand', command));
            return;
    }
}

async function _logNpmStartupVariables() {
    try {
        // Log the NPM version
        let version: string;
        try {
            let syncResult: IExecSyncResult = tl.execSync('npm', '--version');
            if (syncResult.stdout) {
                version = syncResult.stdout.trim();
            }
        } catch (err) {
            tl.debug(`Unable to get NPM config info. Err:( ${err} )`);
        }

        // Log the NPM registries
        let command = tl.getInput(NpmTaskInput.Command);
        let npmRegistriesAry: INpmRegistry[];
        let registryUrlAry = [];
        switch (command) {
            case NpmCommand.Install:
            case NpmCommand.Custom:
                npmRegistriesAry = await npmCustom.getCustomRegistries();
                break;
            case NpmCommand.Publish:
                npmRegistriesAry = [await npmPublish.getPublishRegistry()];
                break;
        }
        for (let registry of npmRegistriesAry) {
            registryUrlAry.push(registry.url)
        }


        let npmTelem = {
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
