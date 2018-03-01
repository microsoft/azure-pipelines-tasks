import * as fs from 'fs';
import * as os from 'os';
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
        default: throw Error(task.loc('PlatformNotRecognized'));
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
    if (!isValidPythonVersionSpec(parameters.versionSpec)) {
        throw new Error(task.loc('InvalidVersionSpec', parameters.versionSpec));
    }

    const installDir: string | null = tool.findLocalTool('Python', parameters.versionSpec);
    if (!installDir) {
        // List available versions
        task.error(task.loc('VersionNotFound', parameters.versionSpec));
        console.log(task.loc('ListAvailableVersions'));
        console.log(tool.findLocalToolVersions('Python').join(os.EOL));
        return;
    }

    task.setVariable(parameters.outputVariable, installDir);
    if (parameters.addToPath) {
        addToPath(installDir);

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
            addToPath(scriptsDir);

            const majorMinorDir = path.basename(installDir);
            const userScriptsDir = path.join(task.getVariable('APPDATA'), 'Python', majorMinorDir, 'Scripts');
            addToPath(userScriptsDir);
        }
    }
}

/**
 * Whether `input` is a valid Python version specifier.
 * @param input A string possibly representing a version specifier
 */
function isValidPythonVersionSpec(input: string): boolean {
    // TODO Python prerelease specifiers?
    if (!semver.parse(input)) {
        return false;
    } else {
        return true;
    }
}

/**
 * Find where the latest Python version matching `versionSpec` is installed, or `null` if there is no version matching the version spec.
 * @param versionSpec A valid semver version specifier string (like 3.x)
 * @param platform OS the build agent is running on
 * @returns Path that Python was installed to
 */
// function findPython(versionSpec: string, platform: Platform): string | null {
//     const { major, minor } = semver.parse(versionSpec)!; // TODO minor versions?
//     if (platform === Platform.Windows) {
//         // Python versions are installed as %LOCALAPPDATA%\Programs\Python\PythonXY\python.exe
//         const localAppData = task.getVariable('LOCALAPPDATA');
//         const installDir = path.join(localAppData, 'Programs', 'Python', `Python${major}${minor}`);
//         if (task.exist(installDir)) {
//             return installDir;
//         } else {
//             return null;
//         }
//     } else {
//         // Python versions are installed as /usr/bin/pythonX.Y or /usr/local/bin/pythonX.Y
//         function hasPython(dir: string): boolean {
//             return task.exist(path.join(dir, `python${major}.${minor}`));
//         };

//         const usrBin = path.join('/', 'usr', 'bin');
//         const usrLocalBin = path.join('/', 'usr', 'local', 'bin');

//         if (hasPython(usrBin)) {
//             return usrBin;
//         } else if (hasPython(usrLocalBin)) {
//             return usrLocalBin;
//         } else {
//             return null;
//         }
//     }
// }

/**
 * Prepend `directory` to the PATH variable for the platform.
 */
function addToPath(directory: string): void {
    const currentPath = task.getVariable('PATH');
    task.setVariable('PATH', directory + path.delimiter + currentPath);
}

run();
