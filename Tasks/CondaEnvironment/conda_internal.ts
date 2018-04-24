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
    // TODO
    return false;
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
 * Download the appropriate Miniconda installer.
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
 * Download the appropriate Miniconda installer.
 * @param installerPath Absolute path to the Miniconda installer.
 * @param platform Platform for which we want to install Miniconda.
 * @returns Absolute path to the install location.
 */
export async function installMiniconda(installerPath: string, platform: Platform): Promise<string> {
    // TODO
    return Promise.reject("not implemented");
}

/**
 * Precondition: `conda` executable is in PATH
 * @param environmentsDir 
 * @param environmentName 
 * @param packageSpecs 
 * @param otherOptions 
 */
export async function createEnvironment(environmentsDir: string, environmentName: string, packageSpecs?: string, otherOptions?: string): Promise<void> {
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

export function activateEnvironment(environmentsDir: string, environmentName: string): void {
    // TODO
}