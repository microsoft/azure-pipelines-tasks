import * as fs from 'fs';
import * as path from 'path';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';
import { ToolRunner } from 'vsts-task-lib/toolrunner';

import { Platform } from './taskutil';

const log = {
    info(message: string) {
        console.log(`[INFO] ${message}`);
    },
    warning(message: string) {
        console.log(`[WARNING] ${message}`);
    },
    error(message: string) {
        console.error(`[ERROR] ${message}`)
    }
};

/** Log `label: ${value}` and pass the value through. */
function trace(label: string, value: any) {
    log.info(`${label}: ${value}`);
    return value;
}


/**
 * Whether `searchDir` has a `conda` executable for `platform`.
 * @param searchDir Absolute path to a directory to look for a `conda` executable in.
 * @param platform Platform whose executable type we want to use (i.e. `conda` vs `conda.exe`)
 * @returns Whether `searchDir` has a `conda` executable for `platform`.
 */
function hasConda(searchDir: string, platform: Platform): boolean {
    const conda = platform === Platform.Windows ?
        path.join(searchDir, 'Scripts', 'conda.exe') :
        path.join(searchDir, 'bin', 'conda');

    return fs.existsSync(conda) && fs.statSync(conda).isFile();
}

/**
 * Search the system for an existing Conda installation.
 * This function will check, in order:
 *   - the `CONDA` environment variable
 *   - `PATH`
 *   - The directory where the agent will install Conda if missing
 */
export function findConda(platform: Platform): string | null {
    log.info('Entering `findConda`');
    const condaFromPath: string | undefined = trace('condaFromPath', task.which('conda'));
    if (condaFromPath) {
        // On all platforms, the `conda` executable lives in a directory off the root of the installation
        return trace('`findConda` returning', path.dirname(path.dirname(condaFromPath)));
    }

    const condaFromEnvironment: string | undefined = trace('condaFromEnvironment', task.getVariable('CONDA'));
    if (condaFromEnvironment && hasConda(condaFromEnvironment, platform)) {
        return condaFromEnvironment;
    }

    log.info('`findConda` returning `null`');
    return null;
}

/**
 * Add Conda's `python` and `conda` executables to PATH.
 * Precondition: Conda is installed at `condaRoot`
 * @param condaRoot Root directory or "prefix" of the Conda installation
 * @param platform Platform for which Conda is installed
 */
export function prependCondaToPath(condaRoot: string, platform: Platform): void {
    if (platform === Platform.Windows) {
        // Windows: `python` lives in `condaRoot` and `conda` lives in `condaRoot\Scripts`
        tool.prependPath(condaRoot);
        tool.prependPath(path.join(condaRoot, 'Scripts'));
    } else {
        // Linux and macOS: `python` and `conda` both live in the `bin` directory
        tool.prependPath(path.join(condaRoot, 'bin'));
    }
}

export async function updateConda(condaRoot: string, platform: Platform): Promise<void> {
    try {
        const conda = (() => {
            if (platform === Platform.Windows) {
                return new ToolRunner(path.join(condaRoot, 'Scripts', 'conda.exe'));
            } else {
                return new ToolRunner(path.join(condaRoot, 'bin', 'conda'));
            }
        })();

        conda.line('update --name base conda --yes');
        await conda.exec();
    } catch (e) {
        // Best effort
    }
}

/**
 * Create a Conda environment by running `conda create`.
 * Precondition: `conda` executable is in PATH
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
    task.setVariable('CONDA_DEFAULT_ENV', environmentName)
    task.setVariable('CONDA_PREFIX', environmentPath)
}