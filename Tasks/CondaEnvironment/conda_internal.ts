import * as task from 'vsts-task-lib/task';
import { ToolRunner } from 'vsts-task-lib/toolrunner';

import { Platform } from './taskutil';

/**
 * Find a Conda installation on the system by looking for a `conda` executable
 * under the path given in the `CONDA` environment variable.
 * @param platform Platform whose executable type we want to use (i.e. `conda` vs `conda.exe`)
 * @returns Absolute path to the `conda` executable or `null` if it was not found
 */
export function findConda(platform: Platform): string | null {
    // TODO
    return null;
}

/**
 * Download the appropriate Miniconda installer.
 * @param platform Platform for which we want to download Miniconda.
 * @returns Absolute path to the download.
 */
export async function downloadMiniconda(platform: Platform): Promise<string> {
    // TODO
    return Promise.reject("not implemented");
}

/**
 * Download the appropriate Miniconda installer.
 * @param installerPath Absolute path to the Miniconda installer.
 * @param platform Platform for which we want to install Miniconda.
 * @returns Absolute path to the install location.
 */
export async function installMiniconda(installerPath: string, platform: Platform): Promise<string> {
    // TODO
    return Promise.reject("not implemented");
}

export async function createEnvironment(condaPath: string, environmentName: string, packageSpecs?: string, otherOptions?: string): Promise<void> {
    // TODO validate `environmentName`
    // TODO validate `otherOptions`
    // TODO
    return Promise.reject("not implemented");
    // const conda = new ToolRunner(condaPath);
    // conda.arg('create');
    // conda.arg(environmentName);
    // if (packageSpecs) {
    //     conda.line(packageSpecs);
    // }

    // const status = await conda.exec();
    // if (status !== 0) {
    //     throw new Error(task.loc('FailedCreate', environmentName, status));
    // }
}

export async function activateEnvironment(environmentPath: string): Promise<number> {
    // TODO
    return Promise.reject("not implemented");
}