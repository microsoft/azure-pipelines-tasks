import fs = require('fs');
import os = require('os');
import path = require('path');
import taskLib = require('azure-pipelines-task-lib/task');
import toolLib = require('azure-pipelines-tool-lib/tool');
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';

import { AzureStorageArtifactDownloader } from './AzureStorageArtifacts/AzureStorageArtifactDownloader';
import { JavaFilesExtractor, BIN_FOLDER } from './FileExtractor/JavaFilesExtractor';
import taskutils = require('./taskutils');

const VOLUMES_FOLDER: string = '/Volumes';
const JDK_FOLDER: string = '/Library/Java/JavaVirtualMachines';
const JDK_HOME_FOLDER: string = 'Contents/Home';
taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run(): Promise<void> {
    try {
        const versionSpec = taskLib.getInput('versionSpec', true);
        const jdkArchitectureOption = taskLib.getInput('jdkArchitectureOption', true);
        await getJava(versionSpec, jdkArchitectureOption);
        taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));
        telemetry.emitTelemetry('TaskHub', 'JavaToolInstallerV0', { versionSpec, jdkArchitectureOption });
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getJava(versionSpec: string, jdkArchitectureOption: string): Promise<void> {
    const preInstalled: boolean = ('PreInstalled' === taskLib.getInput('jdkSourceOption', true));
    const fromAzure: boolean = ('AzureStorage' == taskLib.getInput('jdkSourceOption', true));
    const extractLocation: string = taskLib.getPathInput('jdkDestinationDirectory', true);
    const cleanDestinationDirectory: boolean = taskLib.getBoolInput('cleanDestinationDirectory', false);
    let compressedFileExtension: string;
    let jdkDirectory: string;
    const extendedJavaHome: string = `JAVA_HOME_${versionSpec}_${jdkArchitectureOption}`.toUpperCase();

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Java');
    const version: string = toolLib.evaluateVersions(localVersions, versionSpec);

    if (version) { //This version of Java JDK is already in the cache. Use it instead of downloading again.
        console.log(taskLib.loc('Info_ResolvedToolFromCache', version));
    } else if (preInstalled) {
        const preInstalledJavaDirectory: string | undefined = taskLib.getVariable(extendedJavaHome);
        if (!preInstalledJavaDirectory) {
            throw new Error(taskLib.loc('JavaNotPreinstalled', versionSpec));
        }
        console.log(taskLib.loc('UsePreinstalledJava', preInstalledJavaDirectory));
        jdkDirectory = JavaFilesExtractor.setJavaHome(preInstalledJavaDirectory, false);
    } else {
        if (cleanDestinationDirectory) {
            cleanFolder(extractLocation);
        }
        let jdkFileName: string;
        if (fromAzure) {
            // download from azure and save to temporary directory
            console.log(taskLib.loc('RetrievingJdkFromAzure'));
            const fileNameAndPath: string = taskLib.getInput('azureCommonVirtualFile', true);
            const azureDownloader = new AzureStorageArtifactDownloader(
                taskLib.getInput('azureResourceManagerEndpoint', true),
                taskLib.getInput('azureStorageAccountName', true), 
                taskLib.getInput('azureContainerName', true),
                "",
                taskLib.getInput('azureResourceGroupName', false),
            );
            await azureDownloader.downloadArtifacts(extractLocation, '*' + fileNameAndPath);
            await taskutils.sleepFor(250); //Wait for the file to be released before extracting it.
            let jdkArchiveName = path.basename(fileNameAndPath);
            jdkFileName = path.join(extractLocation, jdkArchiveName);
            toolLib.debug(`jdkFileName: ${jdkFileName}`);
        } else {
            // get from local directory
            console.log(taskLib.loc('RetrievingJdkFromLocalPath'));
            jdkFileName = taskLib.getInput('jdkFile', true);
        }
        compressedFileExtension = JavaFilesExtractor.getSupportedFileEnding(jdkFileName);
        jdkDirectory = await installJDK(jdkFileName, compressedFileExtension, extractLocation, extendedJavaHome, versionSpec, cleanDestinationDirectory);
    }
    console.log(taskLib.loc('SetExtendedJavaHome', extendedJavaHome, jdkDirectory));
    taskLib.setVariable(extendedJavaHome, jdkDirectory);
    toolLib.prependPath(path.join(jdkDirectory, BIN_FOLDER));
}

/**
 * Delete the contents of the destination directory but leave the directory in place
 * @param directory Directory path
 * @returns true if the deletion was successful, false - otherwise
 */
function cleanFolder(directory: string): boolean {
    // Clean the destination folder before downloading and extracting
    if (taskLib.exist(directory) && taskLib.stats(directory).isDirectory) {
        console.log(taskLib.loc('CleanDestDir', directory));
        try {
            fs.readdirSync(directory)
                .forEach((item: string) => {
                    const itemPath = path.join(directory, item);
                    taskLib.rmRF(itemPath);
                });
            return true;
        } catch (err) {
            console.log(taskLib.loc('ErrorCleaningFolder', directory));
            return false;
        }
    }
}

/**
 * Install JDK.
 * @param sourceFile Path to JDK file.
 * @param fileExtension JDK file extension.
 * @param archiveExtractLocation Path to folder to extract a JDK.
 * @returns string
 */
async function installJDK(sourceFile: string, fileExtension: string, archiveExtractLocation: string, extendedJavaHome: string, versionSpec: string, cleanDestinationDirectory: boolean): Promise<string> {
    let jdkDirectory: string;
    if (fileExtension === '.dmg' && os.platform() === 'darwin') {
        // Using set because 'includes' array method requires tsconfig option "lib": ["ES2017"]
        const volumes: Set<string> = new Set(fs.readdirSync(VOLUMES_FOLDER));

        await taskutils.attach(sourceFile);

        const volumePath: string = getVolumePath(volumes);

        const pkgPath: string = getPackagePath(volumePath);
        try {
            jdkDirectory = await installPkg(pkgPath, extendedJavaHome, versionSpec);
        } finally {
            // In case of an error, there is still a need to detach the disk image
            await taskutils.detach(volumePath);
        }
    }
    else if (fileExtension === '.pkg' && os.platform() === 'darwin') {
        jdkDirectory = await installPkg(sourceFile, extendedJavaHome, versionSpec);
    }
    else {
        const createExtractDirectory: boolean = taskLib.getBoolInput('createExtractDirectory', false);
        let extractionDirectory: string = "";
        if (createExtractDirectory) {
            const extractDirectoryName: string = `${extendedJavaHome}_${JavaFilesExtractor.getStrippedName(sourceFile)}_${fileExtension.substr(1)}`;
            extractionDirectory = path.join(archiveExtractLocation, extractDirectoryName);
        } else {
            // we need to remove path separator symbol on the end of archiveExtractLocation path since it could produce issues in getJavaHomeFromStructure method
            if (archiveExtractLocation.endsWith(path.sep)) {
                archiveExtractLocation = archiveExtractLocation.slice(0, -1);
            }

            extractionDirectory = path.normalize(archiveExtractLocation);
        }
        // unpack the archive, set `JAVA_HOME` and save it for further processing
        await unpackArchive(extractionDirectory, sourceFile, fileExtension, cleanDestinationDirectory);
        jdkDirectory = JavaFilesExtractor.setJavaHome(extractionDirectory);
    }
    return jdkDirectory;
}

/**
 * Unpack an archive.
 * @param unpackDir Directory path to unpack files.
 * @param jdkFileName JDK file name.
 * @param fileExt JDK file ending.
 * @param cleanDestinationDirectory Option to clean the destination directory before the JDK is extracted into it.
 * @returns Promise<void>
 */
async function unpackArchive(unpackDir: string, jdkFileName: string, fileExt: string, cleanDestinationDirectory: boolean): Promise<void> {
    const javaFilesExtractor = new JavaFilesExtractor();
    if (!cleanDestinationDirectory && taskLib.exist(unpackDir)) {
        // do nothing since the files were extracted and ready for using
        console.log(taskLib.loc('ArchiveWasExtractedEarlier'));
    } else {
        // unpack files to specified directory
        console.log(taskLib.loc('ExtractingArchiveToPath', unpackDir));
        await javaFilesExtractor.unzipJavaDownload(jdkFileName, fileExt, unpackDir);
    }
}

/**
 * Get the path to a folder inside the VOLUMES_FOLDER.
 * Only for macOS.
 * @param volumes VOLUMES_FOLDER contents before attaching a disk image.
 * @returns string
 */
function getVolumePath(volumes: Set<string>): string {
    const newVolumes: string[] = fs.readdirSync(VOLUMES_FOLDER).filter(volume => !volumes.has(volume));

    if (newVolumes.length !== 1) {
        throw new Error(taskLib.loc('UnsupportedDMGStructure'));
    }
    return path.join(VOLUMES_FOLDER, newVolumes[0]);
}

/**
 * Get path to a .pkg file.
 * Only for macOS.
 * @param volumePath Path to the folder containing a .pkg file.
 * @returns string
 */
function getPackagePath(volumePath: string): string {
    const packages: string[] = fs.readdirSync(volumePath).filter(file => file.endsWith('.pkg'));

    if (packages.length === 1) {
        return path.join(volumePath, packages[0]);
    } else if (packages.length === 0) {
        throw new Error(taskLib.loc('NoPKGFile'));
    } else {
        throw new Error(taskLib.loc('SeveralPKGFiles'));
    }
}

/**
 * Install a .pkg file.
 * @param pkgPath Path to a .pkg file.
 * @param extendedJavaHome Extended JAVA_HOME.
 * @param versionSpec Version of JDK to install.
 * @returns Promise<string>
 */
async function installPkg(pkgPath: string, extendedJavaHome: string, versionSpec: string): Promise<string> {
    if (!fs.existsSync(pkgPath)) {
        throw new Error('PkgPathDoesNotExist');
    }

    console.log(taskLib.loc('InstallJDK'));

    // Using set because 'includes' array method requires tsconfig option "lib": ["ES2017"]
    const JDKs: Set<string> = new Set(fs.readdirSync(JDK_FOLDER));

    await runPkgInstaller(pkgPath);

    const newJDKs: string[] = fs.readdirSync(JDK_FOLDER).filter(jdkName => !JDKs.has(jdkName));

    let jdkDirectory: string;

    if (newJDKs.length === 0) {
        const preInstalledJavaDirectory: string | undefined = taskLib.getVariable(extendedJavaHome);
        if (!preInstalledJavaDirectory) {
            throw new Error(taskLib.loc('JavaNotPreinstalled', versionSpec));
        }
        console.log(taskLib.loc('PreInstalledJavaUpgraded'));
        console.log(taskLib.loc('UsePreinstalledJava', preInstalledJavaDirectory));
        jdkDirectory = preInstalledJavaDirectory;
    } else {
        console.log(taskLib.loc('JavaSuccessfullyInstalled'));
        jdkDirectory = path.join(JDK_FOLDER, newJDKs[0], JDK_HOME_FOLDER);
    }

    return jdkDirectory;
}

/**
 * Install a .pkg file.
 * Only for macOS.
 * Returns promise with return code.
 * @param pkgPath Path to a .pkg file.
 * @returns number
 */
async function runPkgInstaller(pkgPath: string): Promise<number> {
    const installer = taskutils.sudo('installer');
    installer.line(`-package "${pkgPath}" -target /`);
    return installer.exec();
}

run();
