import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import * as cp from 'child_process';
import * as rest from 'typed-rest-client';
import * as task from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';
import * as osutil from './osutil';

const MANIFEST_URL = 'https://raw.githubusercontent.com/actions/setup-python/master/versions-manifest.json';

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

export async function installPythonVersion(versionSpec: string) {
    const pythonInstallerDir: string = await downloadPythonVersion(versionSpec);

    return new Promise<void>((resolve, reject) => {
        const installerCommand = (os.platform() === 'win32') ? 'powershell ./setup.ps1' : 'bash ./setup.sh';

        const installerScriptOptions = {
            cwd: pythonInstallerDir,
            windowsHide: true
        };

        cp.exec(installerCommand, installerScriptOptions, (error) => {
            error ? resolve() : reject(error);
        });
    });
}

async function downloadPythonVersion(versionSpec: string): Promise<string> {
    const restClient = new rest.RestClient('vsts-node-tool');
    const manifest: PythonRelease[] = (await restClient.get<PythonRelease[]>(MANIFEST_URL)).result;
    const matchingPythonFile: PythonFileInfo | null = findPythonFile(manifest, versionSpec);
    if (matchingPythonFile === null) {
        throw new Error(task.loc('DownloadNotFound', versionSpec));
    }

    const pythonArchivePath: string = await tool.downloadTool(matchingPythonFile.download_url);
    if (path.extname(pythonArchivePath) === '.zip') {
        return tool.extractZip(pythonArchivePath);
    } else {
        return tool.extractTar(pythonArchivePath);
    }
}

function findPythonFile(manifest: PythonRelease[], versionSpec: string): PythonFileInfo | null {
    for (const release of manifest) {
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

function matchesOs(file: PythonFileInfo): boolean {
    if (file.platform !== os.platform() || file.arch !== os.arch()) {
        return false;
    }

    if (!file.platform_version) {
        return true;
    }

    return file.platform_version === osutil._getOsVersion();
}
