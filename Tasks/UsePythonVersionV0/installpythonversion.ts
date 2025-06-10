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
        try {
            await task.exec('powershell', './setup.ps1', installerScriptOptions);
            
            // Validate the installation completed successfully
            await validatePythonInstallation(versionSpec, parameters);
            
        } catch (error) {
            // If setup.ps1 fails or produces incomplete installation, try alternative approach
            task.warning(`Standard installation failed or produced incomplete installation: ${error.message}`);
            task.warning('Attempting alternative installation method...');
            
            try {
                await installPythonAlternative(pythonInstallerDir, versionSpec, parameters);
                task.warning('Alternative installation method succeeded');
            } catch (altError) {
                task.error(`Alternative installation method also failed: ${altError.message}`);
                throw new Error(`Both standard and alternative Python installation methods failed. ` +
                              `Standard error: ${error.message}. Alternative error: ${altError.message}`);
            }
        }
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

/**
 * Alternative Python installation method for Windows when the standard setup.ps1 fails.
 * This method runs the Python installer from the extraction directory rather than the target directory.
 * @param pythonInstallerDir directory containing the extracted Python installer.
 * @param versionSpec version specification.
 * @param parameters task parameters.
 */
async function installPythonAlternative(pythonInstallerDir: string, versionSpec: string, parameters: TaskParameters): Promise<void> {
    task.debug('Using alternative Python installation method');
    
    const fs = require('fs');
    
    // Find the Python installer executable in the extracted directory
    const files = fs.readdirSync(pythonInstallerDir);
    const installerFile = files.find((file: string) => file.endsWith('.exe') && file.includes('python'));
    
    if (!installerFile) {
        throw new Error('Python installer executable not found in extracted archive');
    }
    
    const installerPath = path.join(pythonInstallerDir, installerFile);
    task.debug(`Found Python installer: ${installerPath}`);
    
    // Extract version from installer filename (e.g., python-3.12.10-amd64.exe)
    const versionMatch = installerFile.match(/python-(\d+\.\d+\.\d+)/);
    if (!versionMatch) {
        throw new Error(`Could not extract version from installer filename: ${installerFile}`);
    }
    const exactVersion = versionMatch[1];
    
    // Determine installation paths using the same logic as setup.ps1
    const toolcacheRoot = process.env.AGENT_TOOLSDIRECTORY || process.env.RUNNER_TOOL_CACHE;
    if (!toolcacheRoot) {
        throw new Error('Tool cache directory not found. AGENT_TOOLSDIRECTORY or RUNNER_TOOL_CACHE must be set.');
    }
    
    const pythonToolcachePath = path.join(toolcacheRoot, 'Python');
    const pythonVersionPath = path.join(pythonToolcachePath, exactVersion);
    const pythonArchPath = path.join(pythonVersionPath, parameters.architecture);
    
    // Clean up any existing incomplete installation
    if (fs.existsSync(pythonArchPath)) {
        task.debug(`Removing existing installation at ${pythonArchPath}`);
        try {
            // Simple recursive removal using task.exec
            await task.exec('cmd', ['/c', `rmdir /s /q "${pythonArchPath}"`], { windowsHide: true });
        } catch (error) {
            task.warning(`Could not remove existing installation: ${error.message}`);
        }
    }
    
    // Ensure the target directory exists
    if (!fs.existsSync(pythonToolcachePath)) {
        fs.mkdirSync(pythonToolcachePath, { recursive: true });
    }
    if (!fs.existsSync(pythonVersionPath)) {
        fs.mkdirSync(pythonVersionPath, { recursive: true });
    }
    if (!fs.existsSync(pythonArchPath)) {
        fs.mkdirSync(pythonArchPath, { recursive: true });
    }
    
    // Prepare installation parameters (same logic as setup.ps1)
    const isMSI = installerFile.includes('msi');
    const isFreeThreaded = parameters.architecture.includes('-freethreaded');
    
    let execParams: string;
    if (isMSI) {
        execParams = `TARGETDIR="${pythonArchPath}" ALLUSERS=1`;
    } else {
        const includeFreethreaded = isFreeThreaded ? 'Include_freethreaded=1' : '';
        execParams = `DefaultAllUsersTargetDir="${pythonArchPath}" InstallAllUsers=1 ${includeFreethreaded}`;
    }
    
    // Run the installer from the extraction directory (not the target directory)
    const installCommand = `"${installerPath}" ${execParams} /quiet`;
    task.debug(`Running installer: ${installCommand}`);
    
    const installOptions = {
        cwd: pythonInstallerDir,  // Run from extraction directory, not target
        windowsHide: true
    };
    
    await task.exec('cmd', ['/c', installCommand], installOptions);
    
    // Create symlinks and install pip (same as setup.ps1)
    await finalizeInstallation(pythonArchPath, exactVersion);
    
    // Validate the installation
    await validatePythonInstallation(versionSpec, parameters);
    
    task.debug('Alternative Python installation completed successfully');
}

/**
 * Finalize Python installation by creating symlinks and installing pip.
 * @param pythonArchPath path to the Python installation.
 * @param exactVersion exact version string (e.g., "3.12.10").
 */
async function finalizeInstallation(pythonArchPath: string, exactVersion: string): Promise<void> {
    const fs = require('fs');
    const versionParts = exactVersion.match(/^(\d+)\.(\d+)/);
    if (!versionParts) {
        return;
    }
    
    const majorVersion = versionParts[1];
    const minorVersion = versionParts[2];
    
    // Create python3 symlink if it's Python 3.x
    if (majorVersion !== '2') {
        const python3Path = path.join(pythonArchPath, 'python3.exe');
        const pythonPath = path.join(pythonArchPath, 'python.exe');
        
        if (fs.existsSync(pythonPath) && !fs.existsSync(python3Path)) {
            try {
                fs.symlinkSync(pythonPath, python3Path);
            } catch (error) {
                task.warning(`Could not create python3.exe symlink: ${error.message}`);
            }
        }
    }
    
    // Install and upgrade pip
    const pythonExePath = path.join(pythonArchPath, 'python.exe');
    if (fs.existsSync(pythonExePath)) {
        try {
            process.env.PIP_ROOT_USER_ACTION = 'ignore';
            
            const pipInstallOptions = {
                cwd: pythonArchPath,
                windowsHide: true
            };
            
            // Install pip
            await task.exec(pythonExePath, ['-m', 'ensurepip'], pipInstallOptions);
            
            // Upgrade pip
            await task.exec(pythonExePath, ['-m', 'pip', 'install', '--upgrade', '--force-reinstall', 'pip', '--no-warn-script-location'], pipInstallOptions);
            
        } catch (error) {
            task.warning(`Could not install/upgrade pip: ${error.message}`);
        }
    }
    
    // Create completion marker
    const versionPath = path.dirname(pythonArchPath);
    const architecture = path.basename(pythonArchPath);
    const completionFile = path.join(versionPath, `${architecture}.complete`);
    
    try {
        fs.writeFileSync(completionFile, '');
    } catch (error) {
        task.warning(`Could not create completion file: ${error.message}`);
    }
}
 * @param versionSpec version specification.
 * @param parameters task parameters.
 */
async function validatePythonInstallation(versionSpec: string, parameters: TaskParameters): Promise<void> {
    task.debug('Validating Python installation completeness');
    
    // Try to find the installed Python directory
    let installDir = tool.findLocalTool('Python', versionSpec, parameters.architecture);
    
    // If not found with the exact spec, try to find any recent installation
    if (!installDir) {
        const allVersions = tool.findLocalToolVersions('Python', parameters.architecture);
        if (allVersions.length > 0) {
            // Use the most recent version that was just installed
            const latestVersion = allVersions[allVersions.length - 1];
            installDir = tool.findLocalTool('Python', latestVersion, parameters.architecture);
        }
    }
    
    if (!installDir) {
        throw new Error('Python installation validation failed: installation directory not found');
    }

    task.debug(`Validating Python installation in: ${installDir}`);

    // Check for essential files and directories that should exist in a complete Python installation
    const essentialFiles = [
        'python.exe'
    ];

    const essentialDirectories = [
        'Lib',     // Standard library - most critical for "platform independent libraries"
        'libs',    // Contains .lib files for linking
        'include'  // Header files
    ];

    let hasErrors = false;

    // Check essential files
    for (const file of essentialFiles) {
        const filePath = path.join(installDir, file);
        if (!await fileExists(filePath)) {
            task.error(`Python installation is incomplete: missing essential file ${file}`);
            hasErrors = true;
        }
    }

    // Check essential directories
    for (const dir of essentialDirectories) {
        const dirPath = path.join(installDir, dir);
        if (!await directoryExists(dirPath)) {
            task.error(`Python installation is incomplete: missing essential directory ${dir}`);
            hasErrors = true;
        }
    }

    // Specifically check for python*.lib files in the libs directory
    const libsDir = path.join(installDir, 'libs');
    if (await directoryExists(libsDir)) {
        // Extract major.minor version from versionSpec (e.g., "3.12.x" -> "312")
        const versionMatch = versionSpec.match(/^(\d+)\.(\d+)/);
        if (versionMatch) {
            const majorMinor = versionMatch[1] + versionMatch[2];
            const expectedLibFile = path.join(libsDir, `python${majorMinor}.lib`);
            
            if (!await fileExists(expectedLibFile)) {
                task.error(`Python installation is incomplete: missing python${majorMinor}.lib file`);
                hasErrors = true;
            }
        }
    }

    // Check if Lib directory has content (standard library)
    const stdLibDir = path.join(installDir, 'Lib');
    if (await directoryExists(stdLibDir)) {
        if (!await directoryHasContent(stdLibDir)) {
            task.error('Python installation is incomplete: Lib directory is empty (missing standard library)');
            hasErrors = true;
        }
    }

    if (hasErrors) {
        const message = 'Python installation validation failed: installation is incomplete. ' +
                       'This may be due to a known issue with the Python installer when run from certain directories. ' +
                       'The task will now attempt an alternative installation method.';
        throw new Error(message);
    }

    task.debug('Python installation validation completed successfully');
}

/**
 * Helper function to check if a file exists.
 * @param filePath path to the file.
 * @returns true if file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        const fs = require('fs').promises;
        const stats = await fs.stat(filePath);
        return stats.isFile();
    } catch {
        return false;
    }
}

/**
 * Helper function to check if a directory exists.
 * @param dirPath path to the directory.
 * @returns true if directory exists.
 */
async function directoryExists(dirPath: string): Promise<boolean> {
    try {
        const fs = require('fs').promises;
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Helper function to check if a directory has content.
 * @param dirPath path to the directory.
 * @returns true if directory exists and has files.
 */
async function directoryHasContent(dirPath: string): Promise<boolean> {
    try {
        const fs = require('fs').promises;
        const files = await fs.readdir(dirPath);
        return files.length > 0;
    } catch {
        return false;
    }
}
