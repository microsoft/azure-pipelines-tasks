import fs = require('fs');
import path = require('path');
import taskLib = require('vsts-task-lib/task');
import toolLib = require('vsts-task-tool-lib/tool');

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { JavaFilesExtractor } from './FileExtractor/JavaFilesExtractor';
taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
    try {
        let javaVersion = taskLib.getInput('javaVersion', true);
        await getJava(javaVersion);
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    } 
}

async function getJava(javaVersion: string) {
    const fromAzure: boolean = ('azureBlobStorage' == taskLib.getInput('javaArchiveLocationOption', true));
    const extractLocation: string = taskLib.getPathInput('javaDestinationDirectory', true);
    const cleanDestinationDirectory: boolean = taskLib.getBoolInput('cleanDestinationDirectory', false);
    let compressedFileExtension: string;
    let jdkDirectory: string;

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Java');
    const version: string = toolLib.evaluateVersions(localVersions, javaVersion);

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
    } else if (fromAzure) { //Download JDK from an Azure blob storage location and extract.
        console.log(taskLib.loc('RetrievingJdkFromAzure', version));
        compressedFileExtension = getFileEnding(taskLib.getInput('azureCommonVirtualFilePath', true));
    
        const azureDownloader = new AzureStorageArtifactDownloader(taskLib.getInput('azureResourceManagerEndpoint', true), 
            taskLib.getInput('azureStorageAccountName', true), taskLib.getInput('azureContainerName', true), taskLib.getInput('azureCommonVirtualFilePath', false));
        await azureDownloader.downloadArtifacts(extractLocation, '*' + compressedFileExtension);
        await sleepFor(250); //Wait for the file to be released before extracting it.

        const extractSource = buildFilePath(extractLocation, compressedFileExtension);
        jdkDirectory = new JavaFilesExtractor().unzipJavaDownload(extractSource, compressedFileExtension, extractLocation);
    } else { //JDK is in a local directory. Extract to specified target directory.
        console.log(taskLib.loc('RetrievingJdkFromLocalPath', version));
        compressedFileExtension = getFileEnding(taskLib.getInput('javaArchiveFilePath', true));
        jdkDirectory = new JavaFilesExtractor().unzipJavaDownload(taskLib.getInput('javaArchiveFilePath', true), compressedFileExtension, extractLocation);
    }

    let extendedJavaHome = 'JAVA_HOME_' + javaVersion + '_' + taskLib.getInput('javaArchitectureOption', true);
    console.log(taskLib.loc('SetJavaHome', jdkDirectory));
    console.log(taskLib.loc('SetExtendedJavaHome', extendedJavaHome, jdkDirectory));
    taskLib.setVariable('JAVA_HOME', jdkDirectory);
    taskLib.setVariable(extendedJavaHome, jdkDirectory);
} 

function sleepFor(sleepDurationInMillisecondsSeconds): Promise<any> {
    return new Promise((resolve, reeject) => {
        setTimeout(resolve, sleepDurationInMillisecondsSeconds);
    });
}

function buildFilePath(localPathRoot: string, fileEnding: string): string {
    const azureFileSource: string = taskLib.getInput('azureCommonVirtualFilePath', true);
    const fileName = azureFileSource.split(/[\\\/]/).pop();
    const extractSource = path.join(localPathRoot, fileName);

    return extractSource;
}

function getFileEnding(file: string): string {
    let fileEnding = '';

    if (file.endsWith('.tar')) {
        fileEnding = '.tar';
    } else if (file.endsWith('.tar.gz')) {
        fileEnding = '.tar.gz';
    } else if (file.endsWith('.zip')) {
        fileEnding = '.zip';
    } else if (file.endsWith('.7z')) {
        fileEnding = '.7z';
    } else {
        throw new Error(taskLib.loc('UnsupportedFileExtension'));
    }

    return fileEnding;
}

run();  