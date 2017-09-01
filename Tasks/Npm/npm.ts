import * as path from 'path';
import * as url from 'url';

import * as tl from 'vsts-task-lib/task';
import * as vsts from 'vso-node-api/WebApi';
import * as Q from 'q';

import { NpmCommand, NpmTaskInput, RegistryLocation } from './constants';
import * as npmCustom from './npmcustom';
import * as npmPublish from './npmpublish';
import { GetRegistries, NormalizeRegistry } from 'npm-common/npmrcparser';
import { INpmRegistry, NpmRegistry } from 'npm-common/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from './util';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    const command = tl.getInput(NpmTaskInput.Command);
    switch (command) {
        case NpmCommand.Install:
            return npmCustom.run('install');
        case NpmCommand.Publish:
            return npmPublish.run();
        case NpmCommand.Custom:
            return npmCustom.run();
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc('UnknownCommand', command));
            return;
    }
}

main().catch(error => {
    tl.rmRF(util.getTempPath());
    tl.setResult(tl.TaskResult.Failed, error);
});
