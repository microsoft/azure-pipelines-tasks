import fs = require('fs');
import path = require('path');
import taskLib = require('vsts-task-lib/task');
import toolLib = require('vsts-task-tool-lib/tool');

import azureStorageDownloader = require("azure-storage-artifact-downloader/AzureStorageArtifactDownloader");
import { JavaFilesExtractor } from "./FileExtractor/JavaFilesExtractor";
taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        await getJava(versionSpec);
    }
    catch (error) {
        console.error('ERR:' + error.message);
    } 
}

async function getJava(versionSpec: string) {
    const fromAzure: boolean = ('AzureStorage' == taskLib.getInput('jdkSource', true));
    const extractLocation: string = taskLib.getPathInput('jdkDestinationDirectory', true);
    const cleanDestinationFolder: boolean = taskLib.getBoolInput('cleanDestinationFolder', false);
    let compressedFileExtension: string;
    let jdkDirectory: string;

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Java');
    const version: string = toolLib.evaluateVersions(localVersions, versionSpec);

     // Clean the destination folder before downloading and extracting?
     if (cleanDestinationFolder && taskLib.exist(extractLocation) && taskLib.stats(extractLocation).isDirectory) {
        console.log(taskLib.loc('CleanDestDir', extractLocation));

        // delete the contents of the destination directory but leave the directory in place
        fs.readdirSync(extractLocation)
        .forEach((item: string) => {
            let itemPath = path.join(extractLocation, item);
            taskLib.rmRF(itemPath);
        });
    }

    if (version) { //This version of Java JDK is already in the cache. Use it instead of downloading again.
        console.log(taskLib.loc("Info_ResolvedToolFromCache", version));
    }
    else if (fromAzure) { //Download JDK from an Azure blob storage location and extract.
        try {
            compressedFileExtension = getFileEnding(taskLib.getInput('azureCommonVirtualPath', true));
        
            let azureDownloader = new azureStorageDownloader.AzureStorageArtifactDownloader(taskLib.getInput('azureResourceManagerEndpoint', true), taskLib.getInput('azureStorageAccountName', true), taskLib.getInput('azureContainerName', true), taskLib.getInput('azureCommonVirtualPath', false));
            await azureDownloader.downloadArtifacts(extractLocation, '*' + compressedFileExtension);
            await sleepFor(250); //Wait for the file to be released before extracting it.

            let extractSource = buildFilePath(extractLocation, compressedFileExtension);
            jdkDirectory = new JavaFilesExtractor().unzipJavaDownload(extractSource, compressedFileExtension, extractLocation);
        } catch (err) {
            taskLib.error(err.message);
            taskLib.setResult(taskLib.TaskResult.Failed, err.message);
        }
    }
    else { //JDK is in a local directory. Extract to specified target directory.
        try{
            compressedFileExtension = getFileEnding(taskLib.getInput('jdkPath', true));
            jdkDirectory = new JavaFilesExtractor().unzipJavaDownload(taskLib.getInput('jdkPath', true), compressedFileExtension, extractLocation);
        } catch (err) {
            taskLib.error(err.message);
            taskLib.setResult(taskLib.TaskResult.Failed, err.message);
        }
    }

    console.log(taskLib.loc("SetJavaHome", jdkDirectory));
    //taskLib.setVariable('JAVA_HOME', jdkDirectory);
} 

function sleepFor(sleepDurationInMillisecondsSeconds): Promise<any> {
    return new Promise((resolve, reeject) => {
        setTimeout(resolve, sleepDurationInMillisecondsSeconds);
    });
}

function buildFilePath(localPathRoot: string, fileEnding: string): string {
    const azureFileSource: string = taskLib.getInput('azureCommonVirtualPath', true);
    var fileName = azureFileSource.split(/[\\\/]/).pop();
    var extractSource = path.join(localPathRoot, fileName);
    console.log("Extracting JDK from: "+ extractSource);

    return extractSource;
}

function getFileEnding(file: string): string {
    var fileEnding = "";

    if(file.endsWith(".tar")) {
        fileEnding = ".tar";
    } else if(file.endsWith(".tar.gz")) {
        fileEnding = ".tar.gz";
    } else if(file.endsWith(".zip")) {
        fileEnding = ".zip";
    } else if(file.endsWith(".7z")) {
        fileEnding = ".7z";
    }

    return fileEnding;
}
 
run();  