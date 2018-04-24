import * as fs from 'fs';
import * as path from 'path';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';
import { ToolRunner } from 'vsts-task-lib/toolrunner';

import { Platform } from './taskutil';

/**
 * Whether `searchDir` has a `conda` executable for `platform`.
 * @param searchDir Absolute path to a directory to look for a `conda` executable in.
 * @param platform Platform whose executable type we want to use (i.e. `conda` vs `conda.exe`)
 * @returns Whether `searchDir` has a `conda` executable for `platform`.
 */
export function hasConda(searchDir: string, platform: Platform): boolean {
    const conda = platform === Platform.Windows ?
        path.join(searchDir, 'Scripts', 'conda.exe') :
        path.join(searchDir, 'bin', 'conda');

    return fs.existsSync(conda) && fs.statSync(conda).isFile();
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

/**
 * Download the appropriate Miniconda installer for `platform`.
 * @param platform Platform for which we want to download Miniconda.
 * @returns Absolute path to the download.
 */
export function downloadMiniconda(platform: Platform): Promise<string> {
    const url = (() => {
        switch (platform) {
            case Platform.Linux: return 'https://repo.continuum.io/miniconda/Miniconda2-latest-Linux-x86_64.sh';
            case Platform.MacOS: return 'https://repo.continuum.io/miniconda/Miniconda3-latest-MacOSX-x86_64.sh';
            case Platform.Windows: return 'https://repo.continuum.io/miniconda/Miniconda3-latest-Windows-x86_64.exe';
        }
    })();

    return tool.downloadTool(url);
}

/**
 * Run the Miniconda installer.
 * @param installerPath Absolute path to the Miniconda installer.
 * @param platform Platform for which we want to install Miniconda.
 * @returns Absolute path to the install location.
 */
export async function installMiniconda(installerPath: string, platform: Platform): Promise<string> {
    const toolsDirectory = task.getVariable('AGENT_TOOLSDIRECTORY');
    const destination = path.join(toolsDirectory, 'Miniconda');
    const installer = (() => {
        if (platform === Platform.Windows) {
            return new ToolRunner('start').line(`/wait ${installerPath} /S /AddToPath=0 /RegisterPython=0 /D=${destination}`);
        } else {
            return new ToolRunner('bash').line(`${installerPath} -b -f -p ${destination}`);
        }
    })();

    try {
        await installer.exec();
    } catch (e) {
        // vsts-task-lib 2.5.0: `ToolRunner` does not localize its error messages
        throw new Error(task.loc('InstallationFailed', e));
    }

    return destination;
}

/**
 * Create a Conda environment by running `conda create`.
 * Precondition: `conda` executable is in PATH
 * @param environmentsDir Prefix where the environment directory will be created.
 * @param environmentName Name of the environemnt to create.
 * @param packageSpecs Optional list of Conda packages and versions to preinstall in the environment.
 * @param otherOptions Optional list of other options to pass to the `conda create` command.
 */
export async function createEnvironment(environmentsDir: string, environmentName: string, packageSpecs?: string, otherOptions?: string): Promise<void> {
    const prefix = path.join(environmentsDir, environmentName);
    const conda = new ToolRunner('conda');
    conda.line(`create --quiet --yes --prefix ${prefix} --mkdir`);
    if (packageSpecs) {
        conda.line(packageSpecs);
    }

    try {
        await conda.exec();
    } catch (e) {
        // vsts-task-lib 2.5.0: `ToolRunner` does not localize its error messages
        throw new Error(task.loc('CreateFailed', prefix, e));
    }
}

/**
 * Manually activate the environment by setting the variables touched by `conda activate` and prepending the environment to PATH.
 * This allows the environment to remain activated in subsequent build steps.
 */
export function activateEnvironment(environmentsDir: string, environmentName: string): void {
    const environmentPath = path.join(environmentsDir, environmentName);
    tool.prependPath(environmentPath);
    task.setVariable('CONDA_DEFAULT_ENV', environmentName)
    task.setVariable('CONDA_PREFIX', environmentPath)
    task.setVariable('CONDA_PROMPT_MODIFIER', `(${environmentName})`)
}