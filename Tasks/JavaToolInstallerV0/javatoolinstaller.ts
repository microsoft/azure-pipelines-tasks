import fs = require('fs');
import path = require('path');
import taskLib = require('azure-pipelines-task-lib/task');
import toolLib = require('azure-pipelines-tool-lib/tool');

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { JavaFilesExtractor } from './FileExtractor/JavaFilesExtractor';
import {BIN_FOLDER} from "./FileExtractor/JavaFilesExtractor";

taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        await getJava(versionSpec);
        taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getJava(versionSpec: string) {
    const preInstalled: boolean = ("PreInstalled" === taskLib.getInput('jdkSourceOption', true));
    const fromAzure: boolean = ('AzureStorage' == taskLib.getInput('jdkSourceOption', true));
    const extractLocation: string = taskLib.getPathInput('jdkDestinationDirectory', true);
    const cleanDestinationDirectory: boolean = taskLib.getBoolInput('cleanDestinationDirectory', false);
    const unpackArchive = async (unpackDir, jdkFileName, fileExt) => {
        const javaFilesExtractor = new JavaFilesExtractor();
        if (!cleanDestinationDirectory && taskLib.exist(unpackDir)){
            // do nothing since the files were extracted and ready for using
            console.log(taskLib.loc('ArchiveWasExtractedEarlier'));
        } else {
            // unpack files to specified directory
            console.log(taskLib.loc('ExtractingArchiveToPath', unpackDir));
            await javaFilesExtractor.unzipJavaDownload(jdkFileName, fileExt, unpackDir);
        }
    };
    let compressedFileExtension: string;
    let jdkDirectory: string;
    let extractionDirectory: string;
    const extendedJavaHome: string = `JAVA_HOME_${versionSpec}_${taskLib.getInput('jdkArchitectureOption', true)}`;

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Java');
    const version: string = toolLib.evaluateVersions(localVersions, versionSpec);

     // Clean the destination folder before downloading and extracting?
     if (cleanDestinationDirectory && taskLib.exist(extractLocation) && taskLib.stats(extractLocation).isDirectory) {
        console.log(taskLib.loc('CleanDestDir', extractLocation));
        // delete the contents of the destination directory but leave the directory in place
        fs.readdirSync(extractLocation)
        .forEach((item: string) => {
            const itemPath = path.join(extractLocation, item);
            taskLib.rmRF(itemPath);
        });
    }

    if (version) { //This version of Java JDK is already in the cache. Use it instead of downloading again.
        console.log(taskLib.loc('Info_ResolvedToolFromCache', version));
    } else if (preInstalled) {
        const preInstalledJavaDirectory: string | undefined = taskLib.getVariable(extendedJavaHome);
        if (preInstalledJavaDirectory === undefined) {
            throw new Error(taskLib.loc('JavaNotPreinstalled', versionSpec));
        }
        console.log(taskLib.loc('UsePreinstalledJava', preInstalledJavaDirectory));
        jdkDirectory = JavaFilesExtractor.setJavaHome(preInstalledJavaDirectory, false);
    } else {
        let extractDirectoryName;
        let jdkFileName;
        if (fromAzure) {
            // download from azure and save to temporary directory
            console.log(taskLib.loc('RetrievingJdkFromAzure'));
            const fileNameAndPath: string = taskLib.getInput('azureCommonVirtualFile', false);
            const azureDownloader = new AzureStorageArtifactDownloader(taskLib.getInput('azureResourceManagerEndpoint', true),
                taskLib.getInput('azureStorageAccountName', true), taskLib.getInput('azureContainerName', true), "");
            await azureDownloader.downloadArtifacts(extractLocation, '*' + fileNameAndPath);
            await sleepFor(250); //Wait for the file to be released before extracting it.
            jdkFileName = path.join(extractLocation, fileNameAndPath);
        } else {
            // get from local directory
            console.log(taskLib.loc('RetrievingJdkFromLocalPath'));
            jdkFileName = taskLib.getInput('jdkFile', true);
        }
        // unpack the archive, set `JAVA_HOME` and save it for further processing
        compressedFileExtension = JavaFilesExtractor.getFileEnding(jdkFileName);
        extractDirectoryName = `${extendedJavaHome}_${JavaFilesExtractor.getStrippedName(jdkFileName)}_${compressedFileExtension.substr(1)}`;
        extractionDirectory = path.join(extractLocation, extractDirectoryName);
        await unpackArchive(extractionDirectory, jdkFileName, compressedFileExtension);
        jdkDirectory = JavaFilesExtractor.setJavaHome(extractionDirectory);
    }
    console.log(taskLib.loc('SetExtendedJavaHome', extendedJavaHome, jdkDirectory));
    taskLib.setVariable(extendedJavaHome, jdkDirectory);
    toolLib.prependPath(path.join(jdkDirectory, BIN_FOLDER));
}

function sleepFor(sleepDurationInMillisecondsSeconds): Promise<any> {
    return new Promise((resolve, reeject) => {
        setTimeout(resolve, sleepDurationInMillisecondsSeconds);
    });
}

run();
