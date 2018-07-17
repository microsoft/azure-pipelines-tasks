import * as fs from 'fs';
import * as path from 'path';

import * as task from 'vsts-task-lib/task';

import * as internal from './conda_internal';
import { Platform } from './taskutil';

interface TaskParameters {
    createCustomEnvironment?: boolean,
    environmentName?: string,
    packageSpecs?: string,
    updateConda?: boolean,
    installOptions?: string,
    createOptions?: string,
    cleanEnvironment?: boolean
}

/**
 * Check for a parameter at runtime.
 * Useful for conditionally-visible, required parameters.
 */
function assertParameter<T>(value: T | undefined, propertyName: string): T {
    if (!value) {
        throw new Error(task.loc('ParameterRequired', propertyName));
    }

    return value!;
}

export async function condaEnvironment(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    // Find Conda on the system
    const condaRoot = await (async () => {
        const preinstalledConda = internal.findConda(platform);
        if (preinstalledConda) {
            return preinstalledConda;
        } else {
            throw new Error(task.loc('CondaNotFound'));
        }
    })();

    if (parameters.updateConda) {
        await internal.updateConda(condaRoot, platform);
    }

    internal.prependCondaToPath(condaRoot, platform);

    if (parameters.createCustomEnvironment) { // activate the environment, creating it if it does not exist
        const environmentName = assertParameter(parameters.environmentName, 'environmentName');

        const environmentsDir = path.join(condaRoot, 'envs');
        const environmentPath = path.join(environmentsDir, environmentName);

        if (fs.existsSync(environmentPath) && !parameters.cleanEnvironment) {
            console.log(task.loc('ReactivateExistingEnvironment', environmentPath));
        } else { // create the environment
            if (fs.existsSync(environmentPath)) {
                console.log(task.loc('CleanEnvironment', environmentPath));
                task.rmRF(environmentPath);
            }
            await internal.createEnvironment(environmentPath, parameters.packageSpecs, parameters.createOptions);
        }

        internal.activateEnvironment(environmentsDir, environmentName, platform);
    } else if (parameters.packageSpecs) {
        internal.installPackagesGlobally(parameters.packageSpecs, parameters.installOptions);
    }
}
