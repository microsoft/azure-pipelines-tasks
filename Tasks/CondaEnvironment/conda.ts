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
    // TODO validate `environmentName`?
    // TODO validate `otherOptions`?
    const condaPathFromEnvironment = task.getVariable('CONDA');
    const condaRoot = await (async () => {
        if (condaPathFromEnvironment && internal.hasConda(condaPathFromEnvironment, platform)) {
            return condaPathFromEnvironment;
        } else if (parameters.installConda) {
            const downloadPath = await internal.downloadMiniconda(platform);
            const installPath = await internal.installMiniconda(downloadPath, platform);
            task.setVariable('CONDA', installPath);
            return installPath;
        } else {
            throw new Error(task.loc('CondaNotFound', condaPathFromEnvironment));
        }
    })();

    internal.prependCondaToPath(condaRoot, platform);

    const environmentsDir = path.join(condaRoot, 'envs');
    await internal.createEnvironment(environmentsDir, parameters.environmentName, parameters.packageSpecs, parameters.otherOptions);
    internal.activateEnvironment(environmentsDir, parameters.environmentName);
}
