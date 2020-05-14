import * as fs from 'fs';
import * as path from 'path';

import * as task from 'azure-pipelines-task-lib/task';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

import { Platform } from './taskutil';
import { prependPathSafe } from './toolutil';

/**
 * Whether `searchDir` has a `conda` executable for `platform`.
 * @param searchDir Absolute path to a directory to look for a `conda` executable in.
 * @param platform Platform whose executable type we want to use (i.e. `conda` vs `conda.exe`)
 * @returns Whether `searchDir` has a `conda` executable for `platform`.
 */
function hasConda(searchDir: string, platform: Platform): boolean {
    let conda = path.join(binaryDir(searchDir, platform), 'conda');
    if (platform === Platform.Windows) {
        conda += '.exe';
    }

    return fs.existsSync(conda) && fs.statSync(conda).isFile();
}

/**
 * Get the platform-dependent path where binaries are located in an environment.
 * Windows: environmentRoot\Scripts
 * Linux / macOS: environmentRoot/bin
 */
function binaryDir(environmentRoot: string, platform: Platform): string {
    if (platform === Platform.Windows) {
        return path.join(environmentRoot, 'Scripts');
    } else {
        return path.join(environmentRoot, 'bin');
    }
}

/**
 * Run a tool with `sudo` on Linux and macOS
 * Precondition: `toolName` executable is in PATH
 */
function sudo(toolName: string, platform: Platform): ToolRunner {
    if (platform === Platform.Windows) {
        return task.tool(toolName);
    } else {
        const toolPath = task.which(toolName);
        return task.tool('sudo').line(toolPath);
    }
}

/**
 * Search the system for an existing Conda installation.
 * This function will check, in order:
 *   - the `CONDA` environment variable
 *   - `PATH`
 *   - The directory where the agent will install Conda if missing
 */
export function findConda(platform: Platform): string | null {
    const condaFromPath: string | undefined = task.which('conda');
    if (condaFromPath) {
        // On all platforms, the `conda` executable lives in a directory off the root of the installation
        return path.dirname(path.dirname(condaFromPath));
    }

    const condaFromEnvironment: string | undefined = task.getVariable('CONDA');
    if (condaFromEnvironment && hasConda(condaFromEnvironment, platform)) {
        return condaFromEnvironment;
    }

    return null;
}

/**
 * Add Conda's `python` and `conda` executables to PATH.
 * Precondition: Conda is installed at `condaRoot`
 * @param condaRoot Root directory or "prefix" of the Conda installation
 * @param platform Platform for which Conda is installed
 */
export function prependCondaToPath(condaRoot: string, platform: Platform): void {
    prependPathSafe(binaryDir(condaRoot, platform));

    if (platform === Platform.Windows) {
        // Windows: `python` lives in `condaRoot` and `conda` lives in `condaRoot\Scripts`
        // Linux and macOS: `python` and `conda` both live in the `bin` directory
        prependPathSafe(condaRoot);
    }
}

/**
 * Update the `conda` installation
 * Precondition: `conda` executable is in PATH
 */
export async function updateConda(condaRoot: string, platform: Platform): Promise<void> {
    try {
        // Need to sudo since Miniconda is installed in /usr on our hosted Ubuntu 16.04 and macOS agents
        const conda = sudo('conda', platform);
        conda.line('update --name base conda --yes');
        await conda.exec();
    } catch (e) {
        task.debug('Failed to update conda. This is best effort. Continuing ...');
    }
}

/**
 * Create a Conda environment by running `conda create`.
 * Preconditions:
 *  `conda` executable is in PATH
 *  Agent user has write access to `environmentPath`
 * @param environmentPath Absolute path of the directory in which to create the environment. Will be created if it does not exist.
 * @param packageSpecs Optional list of Conda packages and versions to preinstall in the environment.
 * @param otherOptions Optional list of other options to pass to the `conda create` command.
 */
export async function createEnvironment(environmentPath: string, packageSpecs?: string, otherOptions?: string): Promise<void> {
    const conda = task.tool('conda');

    conda.line(`create --quiet --prefix ${environmentPath} --mkdir --yes`);
    if (packageSpecs) {
        conda.line(packageSpecs);
    }

    if (otherOptions) {
        conda.line(otherOptions);
    }

    try {
        await conda.exec();
    } catch (e) {
        // vsts-task-lib 2.5.0: `ToolRunner` does not localize its error messages
        throw new Error(task.loc('CreateFailed', environmentPath, e));
    }
}

/**
 * Manually activate the environment by setting the variables touched by `conda activate` and prepending the environment to PATH.
 * This allows the environment to remain activated in subsequent build steps.
 */
export function activateEnvironment(environmentsDir: string, environmentName: string, platform: Platform): void {
    const environmentPath = path.join(environmentsDir, environmentName);
    prependCondaToPath(environmentPath, platform);

    // If Conda ever changes the names of the environment variables it uses to find its environment, this task will break.
    // For now we will assume these names are stable.
    // If we ever get broken, we should write code to run the activation script, diff the environment before and after,
    // and surface up the new environment variables as build variables.
    task.setVariable('CONDA_DEFAULT_ENV', environmentName);
    task.setVariable('CONDA_PREFIX', environmentPath);
}

/**
 * Install the packages given by `packageSpecs` to the `base` environment.
 */
export async function installPackagesGlobally(packageSpecs: string, platform: Platform, otherOptions?: string): Promise<void> {
    // Need to sudo since Miniconda is installed in /usr on our hosted Ubuntu 16.04 and macOS agents
    const conda = sudo('conda', platform);
    conda.line(`install ${packageSpecs} --quiet --yes`);

    if (otherOptions) {
        conda.line(otherOptions);
    }

    try {
        await conda.exec();
    } catch (e) {
        // vsts-task-lib 2.5.0: `ToolRunner` does not localize its error messages
        throw new Error(task.loc('InstallFailed', e));
    }
}

/**
 * Look up the path to the base environment and add its binary directory to PATH.
 * Precondition: `conda` executable is in PATH
 */
export function addBaseEnvironmentToPath(platform: Platform): void {
    const execResult = task.execSync('conda', 'info --base');
    if (execResult.error) {
        throw execResult.error;
    }

    const baseEnv = execResult.stdout.trim();
    prependPathSafe(binaryDir(baseEnv, platform));
}
