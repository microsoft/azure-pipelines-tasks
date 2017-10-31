import taskLib = require('vsts-task-lib/task');
import toolLib = require('vsts-task-tool-lib/tool');
import path = require('path');

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
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
    toolLib.debug('Trying to get tool from local cache');
    let localVersions: string[] = toolLib.findLocalToolVersions('Java');
    let version: string = toolLib.evaluateVersions(localVersions, versionSpec);
    let fromAzure: boolean = ('AzureStorage' == taskLib.getInput('jdkSource', true));
    let fromLocalDirectory: boolean = ('LocalDirectory' == taskLib.getInput('jdkSource', true));
    let extractLocation: string = taskLib.getPathInput('destinationFolder', true);
    let fileName: string;
    let cleanDestinationFolder: boolean = taskLib.getBoolInput('cleanDestinationFolder', false);
    let fileEnding: string;

     // Clean the destination folder before downloading and extracting?
     if (cleanDestinationFolder && taskLib.exist(extractLocation)) {
        console.log(taskLib.loc('CleanDestDir', extractLocation));
        taskLib.rmRF(extractLocation);
    }

    if (version) { //This version of Java JDK is already in the cache. Use it instead of downloading again.
        console.log(taskLib.loc("Info_ResolvedToolFromCache", version));
    }
    else if (fromAzure) { //Download JDK from an Azure blob storage location and extract.
        try {
            fileEnding = (taskLib.getInput('fileType', true) == 'compressedTar') ? ".tar.gz" : ("." + taskLib.getInput('fileType', true));
            
            await new AzureStorageArtifactDownloader().downloadArtifacts(extractLocation, fileEnding);

            var extractSource = buildFilePath(extractLocation, fileEnding);
            new JavaFilesExtractor().unzipJavaDownload(extractSource, fileEnding);
            fileName = taskLib.getInput('commonVirtualPath', true).split(/[\\\/]/).pop();
        } catch (err) {
            taskLib.debug(err.message);
            taskLib.error(err.message);
            taskLib.setResult(taskLib.TaskResult.Failed, err.message);
        }
    }
    else if (fromLocalDirectory) { //JDK is in a local directory. Extract to specified target directory.
        fileName = taskLib.getInput('jdkPath', true).split(/[\\\/]/).pop();
        fileEnding = getFileEnding(fileName);
        new JavaFilesExtractor().unzipJavaDownload(taskLib.getInput('jdkPath', true), fileEnding);
        fileName = fileName.replace(fileEnding, '');
        getJavaHomePath(taskLib.getInput('jdkPath', true));
    }

    var filePath = path.normalize(taskLib.getPathInput('destinationFolder', true, false).trim());
    var toolPath = path.join(filePath, fileName);
    console.log("JAVA_HOME is being set to: " + toolPath);
    taskLib.setVariable('JAVA_HOME', toolPath);
} 

function buildFilePath(localPathRoot: string, fileEnding: string): string {
    const azureFileSource: string = taskLib.getInput('commonVirtualPath', true);
    var fileName = azureFileSource.split(/[\\\/]/).pop();
    var extractSource = localPathRoot + "\\" + fileName + fileEnding;
    console.log("Extracting JDK from: "+ extractSource);

    return extractSource;
}

function getJavaHomePath(filePath: string): string {
    var javaPath = path.normalize(taskLib.getPathInput('destinationFolder', true, false).trim());
    var fileName = filePath.split(/[\\\/]/).pop().split(".")[0];
    javaPath = path.join(javaPath, fileName);

    return javaPath;
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