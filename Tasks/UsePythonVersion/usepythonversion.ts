import * as fs from 'fs';
import * as path from 'path';

import * as semver from 'semver';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';

enum Platform {
    Windows,
    MacOS,
    Linux
}

/**
 * Determine the operating system the build agent is running on.
 */
function getPlatform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: throw Error("Platform not recognized"); // TODO loc
    }
}

async function run(): Promise<void> {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        await usePythonVersion({
            versionSpec: task.getInput('versionSpec', true),
            outputVariable: task.getInput('outputVariable', true),
            addToPath: task.getBoolInput('addToPath', true)
        },
        getPlatform());
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.error(error.message);
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

interface TaskParameters {
    readonly versionSpec: string,
    readonly outputVariable: string,
    readonly addToPath: boolean
}

async function usePythonVersion(parameters: TaskParameters, platform: Platform): Promise<void> {
    validateVersionSpec(parameters.versionSpec);
    const installDir = findVersion(parameters.versionSpec, platform);
    if (!installDir) {
        // TODO List available versions
        return;
    }

    task.setVariable(parameters.outputVariable, installDir);
    if (parameters.addToPath) {
        addToPath(installDir, platform);

        // Python has "scripts" directories where command-line tools that come with packages are installed.
        // There are different directories for `pip install` and `pip install --user`.
        // On Linux and macOS, pip will create the scripts directories and add them to PATH as needed.
        // On Windows, these directories do not get added to PATH, so we will add them ourselves.
        // For reference, these directories are as follows:
        //   macOS / Linux:
        //      /usr/local/bin
        //      (--user) ~/.local/bin
        //   Windows:
        //      <Python installation dir>\Scripts
        //      (--user) %APPDATA%\Python\PythonXY\Scripts
        if (platform === Platform.Windows) {
            const scriptsDir = path.join(installDir, 'Scripts');
            addToPath(scriptsDir, platform);

            const majorMinorDir = path.basename(installDir);
            const userScriptsDir = path.join(task.getVariable('APPDATA'), 'Python', majorMinorDir, 'Scripts');
            addToPath(userScriptsDir, platform);
        }
    }
}

/**
 * Throw an error if `input` is not a valid Python version specifier.
 * @param input A string possibly representing a version specifier
 */
function validateVersionSpec(input: string): void {
    // TODO Python prerelease specifiers?
    if (!semver.parse(input)) {
        throw Error(); // TODO message
    }
}

/**
 * Find where the latest Python version matching `versionSpec` is installed, or `null` if there is no version matching the version spec.
 * @param versionSpec A valid semver version specifier string (like 3.x)
 * @param platform OS the build agent is running on
 * @returns Path that Python was installed to
 */
function findVersion(versionSpec: string, platform: Platform): string | null {
    const { major, minor } = semver.parse(versionSpec)!; // TODO minor versions?
    if (platform === Platform.Windows) {
        // Python versions are installed as %LOCALAPPDATA%\Programs\Python\PythonXY\python.exe
        const localAppData = task.getVariable('LOCALAPPDATA');
        const installDir = path.join(localAppData, 'Programs', 'Python', `Python${major}${minor}`);
        if (fs.existsSync(installDir)) {
            return installDir;
        } else {
            return null;
        }
    } else {
        // Python versions are installed as /usr/bin/pythonX.Y
        const installDir = path.join('/', 'usr', 'bin');
        if (fs.existsSync(path.join(installDir, `python${major}.${minor}`))) {
            return installDir;
        } else {
            return null;
        }
    }
}

/**
 * Prepend `directory` to the PATH variable for the platform.
 */
function addToPath(directory: string, platform: Platform): void {
    const currentPath = task.getVariable('PATH');
    const pathSeparator = platform === Platform.Windows ? ';' : ':';
    task.setVariable('PATH', directory + pathSeparator + currentPath);
}

run();
