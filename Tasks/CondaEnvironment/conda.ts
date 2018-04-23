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
    if (!condaPath && parameters.installConda) {
        condaPath = await internal.downloadConda(platform);
    } else {
        throw new Error(task.loc('CondaNotFound', task.getVariable('CONDA')));
    }

    await internal.createEnvironment(condaPath, parameters.environmentName, parameters.packageSpecs, parameters.otherOptions);
    await internal.activateEnvironment(parameters.environmentName);
}
