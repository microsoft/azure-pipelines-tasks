import * as path from 'path';

import * as task from 'vsts-task-lib/task';

import * as internal from './conda_internal';
import { Platform } from './taskutil';

interface TaskParameters {
    environmentName: string,
    packageSpecs?: string
    otherOptions?: string,
    installConda: boolean
}

export async function condaEnvironment(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    let condaPath = internal.findConda(platform);
    if (!condaPath) {
        if (parameters.installConda) {
            const download = await internal.downloadMiniconda(platform);
            condaPath = await internal.installMiniconda(download, platform);
        } else {
            throw new Error(task.loc('CondaNotFound', task.getVariable('CONDA')));
        }
    }

    await internal.createEnvironment(condaPath, parameters.environmentName, parameters.packageSpecs, parameters.otherOptions);
    const environmentDir = path.resolve(path.dirname(condaPath), '..', 'envs');
    await internal.activateEnvironment(path.join(environmentDir, parameters.environmentName));
}
