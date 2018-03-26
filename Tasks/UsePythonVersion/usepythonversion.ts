import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as semver from 'semver';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';

export enum Platform {
    Windows,
    MacOS,
    Linux
}

/**
 * Determine the operating system the build agent is running on.
 */
export function getPlatform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: throw Error(task.loc('PlatformNotRecognized'));
    }
}

interface TaskParameters {
    readonly versionSpec: string,
    readonly outputVariable: string,
    readonly addToPath: boolean
}

export async function usePythonVersion(parameters: TaskParameters, platform: Platform): Promise<void> {
    const installDir: string | null = tool.findLocalTool('Python', parameters.versionSpec);
    if (!installDir) {
        // Fail and list available versions
        throw new Error([
            task.loc('VersionNotFound', parameters.versionSpec),
            task.loc('ListAvailableVersions'),
            tool.findLocalToolVersions('Python')
        ].join(os.EOL));
    }

    task.setVariable(parameters.outputVariable, installDir);
    if (parameters.addToPath) {
        tool.prependPath(installDir);

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
            tool.prependPath(scriptsDir);

            // TODO add --user directory once build image is updated
        }
    }
}
