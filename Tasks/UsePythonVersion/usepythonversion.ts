import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as semver from 'semver';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';

import { Platform } from './taskutil';
import * as toolUtil  from './toolutil';

interface TaskParameters {
    versionSpec: string,
    addToPath: boolean,
    architecture: string
}

export function pythonVersionToSemantic(versionSpec: string) {
    const prereleaseVersion = /(\d+\.\d+\.\d+)([a|b|rc]\d*)/g;
    return versionSpec.replace(prereleaseVersion, '$1-$2');
}

export async function usePythonVersion(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    // Python's prelease versions look like `3.7.0b2`.
    // This is the one part of Python versioning that does not look like semantic versioning, which specifies `3.7.0-b2`.
    // If the version spec contains prerelease versions, we need to convert them to the semantic version equivalent
    const semanticVersionSpec = pythonVersionToSemantic(parameters.versionSpec);
    task.debug(`Semantic version spec of ${parameters.versionSpec} is ${semanticVersionSpec}`);

    const installDir: string | null = tool.findLocalTool('Python', semanticVersionSpec, parameters.architecture);
    if (!installDir) {
        // Fail and list available versions
        const x86Versions = tool.findLocalToolVersions('Python', 'x86')
            .map(s => `${s} (x86)`)
            .join(os.EOL);

        const x64Versions = tool.findLocalToolVersions('Python', 'x64')
            .map(s => `${s} (x64)`)
            .join(os.EOL);

        throw new Error([
            task.loc('VersionNotFound', parameters.versionSpec),
            task.loc('ListAvailableVersions'),
            x86Versions,
            x64Versions
        ].join(os.EOL));
    }

    task.setVariable('pythonLocation', installDir);
    if (parameters.addToPath) {
        toolUtil.prependPathSafe(installDir);

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
            toolUtil.prependPathSafe(scriptsDir);

            // Add --user directory
            // `installDir` from tool cache should look like $AGENT_TOOLSDIRECTORY/Python/<semantic version>/x64/
            // So if `findLocalTool` succeeded above, we must have a conformant `installDir`
            const version = path.basename(path.dirname(installDir));
            const major = semver.major(version);
            const minor = semver.minor(version);

            const userScriptsDir = path.join(process.env['APPDATA'], 'Python', `Python${major}${minor}`, 'Scripts');
            toolUtil.prependPathSafe(userScriptsDir);
        }
    }
}
