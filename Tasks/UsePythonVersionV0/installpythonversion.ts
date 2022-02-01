import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import * as rest from 'typed-rest-client';
import * as task from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';
import * as osutil from './osutil';

const MANIFEST_URL = 'https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json';
const OS_VERSION = osutil._getOsVersion();

interface PythonFileInfo {
    filename: string,
    arch: string,
    platform: string,
    platform_version?: string,
    download_url: string
}

interface PythonRelease {
    version: string,
    stable: boolean,
    release_url: string,
    files: PythonFileInfo[]
}

/**
 * Installs specified python version.
 * @param versionSpec version specification.
 * @param allowUnstable whether unstable python versions should be skipped.
 */
export async function installPythonVersion(versionSpec: string, allowUnstable: boolean) {
    const pythonInstallerDir: string = await downloadPythonVersion(versionSpec, allowUnstable);

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
 * @param allowUnstable whether unstable python versions should be skipped.
 * @returns path to the extracted python archive.
 */
async function downloadPythonVersion(versionSpec: string, allowUnstable: boolean): Promise<string> {
    const restClient = new rest.RestClient('vsts-node-tool');
    const manifest: PythonRelease[] = (await restClient.get<PythonRelease[]>(MANIFEST_URL)).result;
    const matchingPythonFile: PythonFileInfo | null = findPythonFile(manifest, versionSpec, allowUnstable);
    if (matchingPythonFile === null) {
        throw new Error(task.loc('DownloadNotFound', versionSpec));
    }

    task.debug(`Found matching file for system: ${matchingPythonFile.filename}`);

    const pythonArchivePath: string = await tool.downloadTool(matchingPythonFile.download_url);

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
 * @param allowUnstable whether unstable releases should be allowed.
 * @returns matching python file for the system.
 */
function findPythonFile(manifest: PythonRelease[], versionSpec: string, allowUnstable: boolean): PythonFileInfo | null {
    for (const release of manifest) {
        if (!allowUnstable && !release.stable) {
            continue;
        }

        if (!semver.satisfies(release.version, versionSpec)) {
            continue;
        }

        const matchingFile: PythonFileInfo | undefined = release.files.find(
            (file: PythonFileInfo) => matchesOs(file)
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
 * @returns whether the file matches the host OS.
 */
function matchesOs(file: PythonFileInfo): boolean {
    if (file.platform !== os.platform() || file.arch !== os.arch()) {
        return false;
    }

    if (!file.platform_version) {
        return true;
    }

    return file.platform_version === OS_VERSION;
}
