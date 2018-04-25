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

    // By default `downloadTool` will name the downloaded file with a GUID
    // But on Windows, the file must end with `.exe` to make it executable
    const tempDirectory = task.getVariable('AGENT_TEMPDIRECTORY');
    const filename = url.split('/').pop()!;
    return tool.downloadTool(url, path.join(tempDirectory, filename));
}

/**
 * Run the Miniconda installer.
 * @param installerPath Absolute path to the Miniconda installer.
 * @param platform Platform for which we want to install Miniconda.
 * @returns Absolute path to the install location.
 */
export async function installMiniconda(installerPath: string, platform: Platform): Promise<string> {
    const toolsDirectory = task.getVariable('AGENT_TOOLSDIRECTORY');
    const destination = path.join(toolsDirectory, 'Miniconda', 'latest');
    const installer = (() => {
        if (platform === Platform.Windows) {
            return new ToolRunner(installerPath).line(`/S /AddToPath=0 /RegisterPython=0 /D=${destination}`);
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
 * @param environmentPath Absolute path of the directory in which to create the environment. Will be created if it does not exist.
 * @param packageSpecs Optional list of Conda packages and versions to preinstall in the environment.
 * @param otherOptions Optional list of other options to pass to the `conda create` command.
 */
export async function createEnvironment(environmentPath: string, packageSpecs?: string, otherOptions?: string): Promise<void> {
    const conda = new ToolRunner('conda');
    conda.line(`create --quiet --yes --prefix ${environmentPath} --mkdir`);
    if (packageSpecs) {
        conda.line(packageSpecs);
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