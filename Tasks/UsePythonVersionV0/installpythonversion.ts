import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import * as rest from 'typed-rest-client';
import * as task from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';
import * as osutil from './osutil';

import { TaskParameters, PythonRelease, PythonFileInfo } from './interfaces';

const MANIFEST_URL = 'https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json';
const OS_VERSION = osutil._getOsVersion();

/**
 * Installs specified python version.
 * This puts python binaries in the tools directory for later use.
 * @param versionSpec version specification.
 * @param parameters task parameters.
 */
export async function installPythonVersion(versionSpec: string, parameters: TaskParameters) {
    const pythonInstallerDir: string = await downloadPythonVersion(versionSpec, parameters);

    task.debug(`Extracted python archive to ${pythonInstallerDir}; running installation script`);

    const installerScriptOptions = {
        cwd: pythonInstallerDir,
        windowsHide: true
    };

    if (os.platform() === 'win32') {
        return task.exec('powershell', './setup.ps1', installerScriptOptions);
    } else {
        return task.exec('bash', './setup.sh', installerScriptOptions);
    }
}

/**
 * Downloads and extracts python file for the host system.
 * Looks for python files from the github actions python versions manifest.
 * Throws if file is not found.
 * @param versionSpec version specification.
 * @param parameters task parameters.
 * @returns path to the extracted python archive.
 */
async function downloadPythonVersion(versionSpec: string, parameters: TaskParameters): Promise<string> {
    const auth = `token ${parameters.githubToken}`;
    const additionalHeaders = {};
    if (parameters.githubToken) {
        additionalHeaders['Authorization'] = auth;
    } else {
        task.warning(task.loc('MissingGithubToken'));
    }

    task.debug('Downloading manifest');

    const restClient = new rest.RestClient('vsts-node-tool');
    const response: rest.IRestResponse<PythonRelease[]> = await restClient.get(MANIFEST_URL, {
        additionalHeaders
    });

    if (!response.result) {
        throw new Error(task.loc('ManifestDownloadFailed'));
    }

    const manifest: PythonRelease[] = response.result;

    const matchingPythonFile: PythonFileInfo | null = findPythonFile(manifest, versionSpec, parameters);
    if (matchingPythonFile === null) {
        throw new Error(task.loc('DownloadNotFound', versionSpec, parameters.architecture));
    }

    task.debug(`Found matching file for system: ${matchingPythonFile.filename}`);

    const pythonArchivePath: string = await tool.downloadTool(matchingPythonFile.download_url, null, null, additionalHeaders);

    task.debug(`Downloaded python archive to ${pythonArchivePath}`);

    if (path.extname(pythonArchivePath) === '.zip') {
        return tool.extractZip(pythonArchivePath);
    } else {
        return tool.extractTar(pythonArchivePath);
    }
}

/**
 * Looks through the releases of the manifest and tries to find the one that has matching version.
 * Skips unstable releases if `allowUnstable` is set to false.
 * @param manifest Python versions manifest containing python releases.
 * @param versionSpec version specification.
 * @param parameters task parameters.
 * @returns matching python file for the system.
 */
function findPythonFile(manifest: PythonRelease[], versionSpec: string, parameters: TaskParameters): PythonFileInfo | null {
    for (const release of manifest) {
        if (!parameters.allowUnstable && !release.stable) {
            continue;
        }

        if (!semver.satisfies(release.version, versionSpec)) {
            continue;
        }

        const matchingFile: PythonFileInfo | undefined = release.files.find(
            (file: PythonFileInfo) => matchesOs(file, parameters.architecture)
        );
        if (matchingFile === undefined) {
            continue;
        }

        return matchingFile;
    }

    return null;
}

/**
 * Checks whether the passed file matches the host OS by comparing platform, arch, and platform version if present.
 * @param file python file info.
 * @param architecture python installer architecture.
 * @returns whether the file matches the host OS.
 */
function matchesOs(file: PythonFileInfo, architecture: string): boolean {
    if (file.platform !== os.platform() || file.arch !== architecture) {
        return false;
    }

    if (!file.platform_version) {
        return true;
    }

    return file.platform_version === OS_VERSION;
}
