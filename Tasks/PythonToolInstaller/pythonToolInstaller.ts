import fs = require('fs');
import path = require('path');
import taskLib = require('vsts-task-lib/task');
import toolLib = require('vsts-task-tool-lib/tool');

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { FileExtractor } from './FileExtractor/FileExtractor';
taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true); // TODO: shouldn't actually accept a versionspec here
        await getPython(versionSpec);
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getPython(versionSpec: string) {
    const fromAzure: boolean = ('AzureStorage' == taskLib.getInput('jdkSourceOption', true));
    const extractLocation: string = taskLib.getPathInput('jdkDestinationDirectory', true);
    const cleanDestinationDirectory: boolean = taskLib.getBoolInput('cleanDestinationDirectory', false);

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Python');
    const version: string = toolLib.evaluateVersions(localVersions, versionSpec);

     // Clean the destination folder before downloading and extracting?
     if (cleanDestinationDirectory && taskLib.exist(extractLocation) && taskLib.stats(extractLocation).isDirectory) {
        console.log(taskLib.loc('CleanDestDir', extractLocation));

        // delete the contents of the destination directory but leave the directory in place
        for (let item of fs.readdirSync(extractLocation)) {
            const itemPath = path.join(extractLocation, item);
            taskLib.rmRF(itemPath);
        }
    }

    const extractedContents = invoke(async () => {
        if (version) { // Tool cache
            console.log(taskLib.loc('Info_ResolvedToolFromCache', version));
            return Promise.resolve<string>(null);
        } else if (fromAzure) { // download from Azure
            console.log(taskLib.loc('RetrievingJdkFromAzure', version)); // TODO
            const compressedFileExtension = getFileEnding(taskLib.getInput('azureCommonVirtualFile', true));

            const azureDownloader = new AzureStorageArtifactDownloader(
                taskLib.getInput('azureResourceManagerEndpoint', true),
                taskLib.getInput('azureStorageAccountName', true),
                taskLib.getInput('azureContainerName', true),
                taskLib.getInput('azureCommonVirtualFile', false));

            await azureDownloader.downloadArtifacts(extractLocation, '*' + compressedFileExtension);
            await sleep(250); // Wait for the file to be released before extracting it.

            const extractSource = buildFilePath(extractLocation, compressedFileExtension);
            return new FileExtractor().extractCompressedFile(extractSource, compressedFileExtension, extractLocation);
        } else { // local directory
            console.log(taskLib.loc('RetrievingJdkFromLocalPath', version)); // TODO

            const file = taskLib.getInput('compressedFile', true)
            const compressedFileExtension = getFileEnding(file);
            return new FileExtractor().extractCompressedFile(file, compressedFileExtension, extractLocation);
        }
    });

    // TODO
    // taskLib.debug(`Set output variable ${x} to ${y}`);
    // taskLib.setVariable(x, y);
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(resolve, milliseconds);
    });
}

function invoke<T>(f: (...args: any[]) => T): T {
    return f();
}

function buildFilePath(localPathRoot: string, fileEnding: string): string {
    const azureFileSource: string = taskLib.getInput('azureCommonVirtualFile', true);
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
    } else if (file.endsWith('.tgz')) {
        fileEnding = '.tgz';
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
