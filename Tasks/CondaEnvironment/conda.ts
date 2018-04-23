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
    const condaPathFromEnvironment = task.getVariable('CONDA');
    const condaRoot = await (async () => {
        if (condaPathFromEnvironment && internal.hasConda(condaPathFromEnvironment, platform)) {
            return condaPathFromEnvironment;
        } else {
            if (parameters.installConda) {
                const download = await internal.downloadMiniconda(platform);
                return await internal.installMiniconda(download, platform);
            } else {
                throw new Error(task.loc('CondaNotFound', condaPathFromEnvironment));
            }
        }
    })();

    await internal.createEnvironment(condaRoot, parameters.environmentName, parameters.packageSpecs, parameters.otherOptions);
    const environmentDir = path.join(condaRoot, 'envs');
    await internal.activateEnvironment(path.join(environmentDir, parameters.environmentName));
}
