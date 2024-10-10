import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import * as fs from 'fs';
import * as rest from 'typed-rest-client';
import * as task from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';
import * as osutil from './osutil';

import { TaskParameters, PythonRelease, PythonFileInfo } from './interfaces';
import { PassThrough } from 'stream';

const MANIFEST_URL = 'https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json';
const OS_VERSION = osutil._getOsVersion();

/**
 * Installs specified python version.
 * This puts python binaries in the tools directory for later use.
 * @param versionSpec version specification.
 * @param parameters task parameters.
 */
export async function installPythonVersion(versionSpec: string, parameters: TaskParameters) {
    console.log("installPythonVersion function called");
    if (parameters.fromGitHubActionsRegistry == true) {
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

    else if (parameters.fromPythonDistribution == true) {
        const pythonInstallerFile: string = await downloadFromPythonOrg(versionSpec, parameters);

        task.debug(`Downloaded Python Installer file to ${pythonInstallerFile}; running installation script`);

        const parentdir = path.dirname(pythonInstallerFile);

        task.debug(`Parent directory of python installer is ${parentdir}`);


        // For Windows
        if (os.platform() === 'win32') {
            //copy a powershell script in this folder to the above absolute path
            const powershellScriptPath = path.join(__dirname, 'windows_setup.ps1');
            task.debug(`Powershell script path is ${powershellScriptPath}`);
            const powershellScriptPathAbs = path.resolve(powershellScriptPath);
            task.debug(`Powershell script path absolute is ${powershellScriptPathAbs}`);

            fs.copyFileSync(powershellScriptPathAbs, `${parentdir}/windows_setup.ps1`);
            task.debug(`Copied powershell script to ${parentdir}`);

            //  set arguments for the powershell script - architecture, version and filename

            const pythonVersion = versionSpec;
            const pythonArchitecture = parameters.architecture;
            const pythonFilename = path.basename(pythonInstallerFile);

            //pass the arguments to the powershell script
            const powershellScriptArgs = `-Architecture ${pythonArchitecture} -Version ${pythonVersion}  -PythonExecName ${pythonFilename}`;
            
            //navigate to that directory and then run the powershell script
            const installerScriptOptions = {
                cwd: parentdir,
                windowsHide: true
            };

            return task.exec('powershell', `./windows_setup.ps1 ${powershellScriptArgs}`, installerScriptOptions);
        }

        else if (os.platform() === 'linux') {
            const setupScriptPath = path.join(__dirname, 'linux_setup.sh');
            task.debug(`Setup script path is ${setupScriptPath}`);
            const setupScriptPathAbs = path.resolve(setupScriptPath);
            task.debug(`Setup script path absolute is ${setupScriptPathAbs}`);

            fs.copyFileSync(setupScriptPathAbs, `${pythonInstallerFile}/linux_setup.sh`);
            task.debug(`Copied setup script to ${pythonInstallerFile}`);

            const pythonVersion = versionSpec;
            const pythonArchitecture = parameters.architecture;

            const setupScriptArgs = `${pythonVersion} ${pythonArchitecture}`;

            const installerScriptOptions = {
                cwd: pythonInstallerFile,
                windowsHide: true
            };

            return task.exec('bash', `./linux_setup.sh ${setupScriptArgs}`, installerScriptOptions);
        }

        else if (os.platform() === 'darwin') {
            const setupScriptPath = path.join(__dirname, 'macos_setup.sh');
            task.debug(`Setup script path is ${setupScriptPath}`);
            const setupScriptPathAbs = path.resolve(setupScriptPath);
            task.debug(`Setup script path absolute is ${setupScriptPathAbs}`);

            fs.copyFileSync(setupScriptPathAbs, `${parentdir}/macos_setup.sh`);
            task.debug(`Copied setup script to ${parentdir}`);

            const pythonVersion = versionSpec;
            const pythonArchitecture = parameters.architecture;
            const pythonFilename = path.basename(pythonInstallerFile);

            const setupScriptArgs = `${pythonVersion} ${pythonFilename} ${pythonArchitecture}`;

            const installerScriptOptions = {
                cwd: parentdir,
                windowsHide: true
            };

            return task.exec('bash', `./macos_setup.sh ${setupScriptArgs}`, installerScriptOptions);
        }
        else {
            throw new Error(task.loc('OSNotSupported', os.platform()));
        }


    }

}
/**
 * Function to download and install python from the python.org website.
 * Looks for python files from python.org based on version number and downloads .exe file for Windows, and .tar.gz for Linux.
 * Throws if file is not found
 */
async function downloadFromPythonOrg(versionSpec: string, parameters: TaskParameters): Promise<string> {
    let downloadUrl: string;
    let fileName: string;

    task.debug(`OS platform is ${os.platform()}`);

    // Download .exe if windows (separate for 32-bit and 64-bit), and .tgz if linux, and .pkg if mac
    if (os.platform() === 'win32') {
        if (parameters.architecture === 'x64') {
            downloadUrl = `https://www.python.org/ftp/python/${versionSpec}/python-${versionSpec}-amd64.exe`;
            task.debug('Download url is: ' + downloadUrl);
            fileName = `python-${versionSpec}-amd64.exe`;
            task.debug('File name is: ' + fileName);
        }
        else {
            downloadUrl = `https://www.python.org/ftp/python/${versionSpec}/python-${versionSpec}.exe`;
            fileName = `python-${versionSpec}.exe`;
        }
    } else if (os.platform() === 'linux') {
        downloadUrl = `https://www.python.org/ftp/python/${versionSpec}/Python-${versionSpec}.tgz`;
        fileName = `Python-${versionSpec}.tgz`;
        
        
    } // TODO: verify is os platform returns 'darwin'
    else if (os.platform() === 'darwin') { 
        downloadUrl = `https://www.python.org/ftp/python/${versionSpec}/python-${versionSpec}-macos11.pkg`;
        fileName = `python-${versionSpec}-macos11.pkg`;
    } else {
        throw new Error(task.loc('OSNotSupported', os.platform()));
    }

    task.debug(`Downloading Python from ${downloadUrl}`);

    const pythonArchivePath: string = await tool.downloadTool(downloadUrl, fileName);

    task.debug(`Downloaded python installer/archive to ${pythonArchivePath}`);

    //return path to the extracted python installer file/archive

    if (os.platform() === 'win32') {
        return pythonArchivePath;
    } else if (os.platform() === 'linux') {
        return tool.extractTar(pythonArchivePath);
    }
    else if (os.platform() === 'darwin') {
        return pythonArchivePath;
    }
    else {
        throw new Error(task.loc('OSNotSupported', os.platform()));
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

    const pythonArchivePath: string = await tool.downloadTool(matchingPythonFile.download_url, matchingPythonFile.filename, null, additionalHeaders);

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
