import fs = require('fs');
import path = require('path');
import taskLib = require('vsts-task-lib/task');
import toolLib = require('vsts-task-tool-lib/tool');

import azureStorageDownloader = require('azure-storage-artifact-downloader/AzureStorageArtifactDownloader');
import { JavaFilesExtractor } from './FileExtractor/JavaFilesExtractor';
taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        await getJava(versionSpec);
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
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
            const itemPath = path.join(extractLocation, item);
            taskLib.rmRF(itemPath);
        });
    }

    if (version) { //This version of Java JDK is already in the cache. Use it instead of downloading again.
        console.log(taskLib.loc('Info_ResolvedToolFromCache', version));
    } else if (fromAzure) { //Download JDK from an Azure blob storage location and extract.
        console.log(taskLib.loc('RetrievingJdkFromAzure', version));
        compressedFileExtension = getFileEnding(taskLib.getInput('azureCommonVirtualPath', true));
    
        const azureDownloader = new azureStorageDownloader.AzureStorageArtifactDownloader(taskLib.getInput('azureResourceManagerEndpoint', true), 
            taskLib.getInput('azureStorageAccountName', true), taskLib.getInput('azureContainerName', true), taskLib.getInput('azureCommonVirtualPath', false));
        await azureDownloader.downloadArtifacts(extractLocation, '*' + compressedFileExtension);
        await sleepFor(250); //Wait for the file to be released before extracting it.

        const extractSource = buildFilePath(extractLocation, compressedFileExtension);
        jdkDirectory = new JavaFilesExtractor().unzipJavaDownload(extractSource, compressedFileExtension, extractLocation);
    } else { //JDK is in a local directory. Extract to specified target directory.
        console.log(taskLib.loc('RetrievingJdkFromLocalPath', version));
        compressedFileExtension = getFileEnding(taskLib.getInput('jdkPath', true));
        jdkDirectory = new JavaFilesExtractor().unzipJavaDownload(taskLib.getInput('jdkPath', true), compressedFileExtension, extractLocation);
    }

    unpackJars(jdkDirectory, path.join(jdkDirectory, 'bin'));

    let extendedJavaHome = 'JAVA_HOME_' + versionSpec + '_' + taskLib.getInput('jdkArch', true);
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
    const azureFileSource: string = taskLib.getInput('azureCommonVirtualPath', true);
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

// This method recursively finds all .pack files under fsPath and unpacks them with the unpack200 tool
function unpackJars(fsPath, javaBinPath) {
    if (fs.existsSync(fsPath)) {
        if (fs.lstatSync(fsPath).isDirectory()) {
            fs.readdirSync(fsPath).forEach(function(file,index){
                const curPath = path.join(fsPath, file);
                unpackJars(curPath, javaBinPath);
            });
        } else if (path.extname(fsPath).toLowerCase() === '.pack') {
            // Unpack the pack file synchonously
            var p = path.parse(fsPath);
            var toolName = process.platform.match(/^win/i) ? 'unpack200.exe' : 'unpack200'; 
            var args = process.platform.match(/^win/i) ? '-r -v -l ""' : '';            
            var name = path.join(p.dir, p.name);
            taskLib.execSync(path.join(javaBinPath, toolName), `${args} "${name}.pack" "${name}.jar"`); 
        }
    }    
}
 
run();  