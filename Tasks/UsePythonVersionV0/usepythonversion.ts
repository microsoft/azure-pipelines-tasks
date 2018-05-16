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

        // Make sure Python's "bin" directories are in PATH.
        // Python has "scripts" or "bin" directories where command-line tools that come with packages are installed.
        // This is where pip is, along with anything that pip installs.
        // There is a seperate directory for `pip install --user`.
        //
        // For reference, these directories are as follows:
        //   macOS / Linux:
        //      <sys.prefix>/bin (by default /usr/local/bin, but not on hosted agents -- see the `else`)
        //      (--user) ~/.local/bin
        //   Windows:
        //      <Python installation dir>\Scripts
        //      (--user) %APPDATA%\Python\PythonXY\Scripts
        // See https://docs.python.org/3/library/sysconfig.html
        if (platform === Platform.Windows) {
            // On Windows, these directories do not get added to PATH, so we will add them ourselves.
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
        } else {
            // On Linux and macOS, tools cache should be set up so that each Python version has its own "bin" directory.
            // We do this so that the tool cache can just be dropped on an agent with minimal installation (no copying to /usr/local).
            // This allows us side-by-side the same minor version of Python with different patch versions or architectures (since Python uses /usr/local/lib/python3.6, etc.).
            toolUtil.prependPathSafe(path.join(installDir, 'bin'));

            // On Linux and macOS, pip will create the --user directory and add it to PATH as needed.
        }
    }
}
