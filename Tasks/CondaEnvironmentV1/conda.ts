import * as fs from 'fs';
import * as path from 'path';

import * as task from 'azure-pipelines-task-lib/task';

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
    const condaRoot = internal.findConda(platform);
    if (!condaRoot) {
        throw new Error(task.loc('CondaNotFound'));
    }

    internal.prependCondaToPath(condaRoot, platform);

    if (parameters.updateConda) {
        await internal.updateConda(condaRoot, platform);
    }

    if (parameters.createCustomEnvironment) { // activate the environment, creating it if it does not exist
        const environmentName = assertParameter(parameters.environmentName, 'environmentName');

        const homeVariable = platform === Platform.Windows ? 'USERPROFILE' : 'HOME';
        const environmentsDir = path.join(task.getVariable(homeVariable) || "", '.conda', 'envs');
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

        // Set this environment variable to prevent foot-shooting if the user tries to run a command like
        // `conda envs update -n {environmentName}` later in the job
        task.setVariable('CONDA_ENVS_PATH', environmentsDir);

        internal.activateEnvironment(environmentsDir, environmentName, platform);
    } else if (parameters.packageSpecs) {
        await internal.installPackagesGlobally(parameters.packageSpecs, platform, parameters.installOptions);
        internal.addBaseEnvironmentToPath(platform);
    }
}
