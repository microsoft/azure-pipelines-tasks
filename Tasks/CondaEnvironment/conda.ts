import * as fs from 'fs';
import * as path from 'path';

import * as task from 'vsts-task-lib/task';

import * as internal from './conda_internal';
import { Platform } from './taskutil';

interface TaskParameters {
    environmentName: string,
    packageSpecs?: string,
    getLatestConda?: boolean,
    otherOptions?: string
}

export async function condaEnvironment(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    // Find Conda on the system, or install it if it is missing and the user requested it
    const condaRoot = await (async () => {
        const preinstalledConda = internal.findConda(platform);
        if (preinstalledConda) {
            if (parameters.getLatestConda) {
                internal.updateConda(preinstalledConda, platform);
            }
            return preinstalledConda;
        } else if (parameters.getLatestConda) {
            const downloadPath = await internal.downloadMiniconda(platform);
            return await internal.installMiniconda(downloadPath, platform);
        } else {
            throw new Error(task.loc('CondaNotFound'));
        }
    })();

    internal.prependCondaToPath(condaRoot, platform);

    // Activate the environment, creating it if it does not exist
    const environmentsDir = path.join(condaRoot, 'envs');
    const environmentPath = path.join(environmentsDir, parameters.environmentName);
    if (fs.existsSync(environmentPath)) {
        console.log(task.loc('FoundEnvironment', environmentPath));
    } else {
        await internal.createEnvironment(environmentPath, parameters.packageSpecs, parameters.otherOptions);
    }

    internal.activateEnvironment(environmentsDir, parameters.environmentName, platform);
}
