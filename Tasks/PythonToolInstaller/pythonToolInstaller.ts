import * as fs from 'fs';
import * as path from 'path';
import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { FileExtractor } from './FileExtractor/FileExtractor';

async function run() {
    try {
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));
        await getPython(
            taskLib.getInput('versionSpec', true),
            taskLib.getInput('architectureOption', true),
            taskLib.getInput('installationSource', true) === 'AzureStorage',
            taskLib.getPathInput('destinationDirectory', true),
            taskLib.getBoolInput('cleanDestinationDirectory', false));
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getPython(versionSpec: string, architecture: string, fromAzure: boolean, destination: string, cleanDestination: boolean) {
    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Python');
    const version: string = toolLib.evaluateVersions(localVersions, versionSpec);

     // Clean the destination folder before downloading and extracting?
     if (cleanDestination && taskLib.exist(destination) && taskLib.stats(destination).isDirectory) {
        console.log(taskLib.loc('CleanDestDir', destination));

        // delete the contents of the destination directory but leave the directory in place
        for (let item of fs.readdirSync(destination)) {
            const itemPath = path.join(destination, item);
            taskLib.rmRF(itemPath);
        }
    }

    const extractedContents: Promise<string | null> = (async () => {
        if (version) { // Tool cache
            console.log(taskLib.loc('Info_ResolvedToolFromCache', version));
            return Promise.resolve<string>(null);
        } else if (fromAzure) { // download from Azure
            console.log(taskLib.loc('RetrievingPythonFromAzure', versionSpec, architecture));
            const file = taskLib.getInput('azureCommonVirtualFile', true);

            const azureDownloader = new AzureStorageArtifactDownloader(
                taskLib.getInput('azureResourceManagerEndpoint', true),
                taskLib.getInput('azureStorageAccountName', true),
                taskLib.getInput('azureContainerName', true),
                file);

            await azureDownloader.downloadArtifacts(destination, '*' + path.extname(file));
            await sleep(250); // Wait for the file to be released before extracting it.

            const compressedFile = buildFilePath(destination, file);
            return await new FileExtractor().extractCompressedFile(compressedFile, destination);
        } else { // file path
            console.log(taskLib.loc('RetrievingPythonFromFilePath', versionSpec, architecture));

            const compressedFile = taskLib.getInput('compressedFile', true)
            return await new FileExtractor().extractCompressedFile(compressedFile, destination);
        }
    })();

    extractedContents.then(extractedContents => console.log(`Extracted contents: ${extractedContents}`));

    // TODO
    // taskLib.debug(`Set output variable ${x} to ${y}`);
    // taskLib.setVariable(x, y);
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(resolve, milliseconds);
    });
}

function buildFilePath(root: string, file: string): string {
    const fileName = file.split(/[\\\/]/).pop();
    return path.join(root, fileName);
}

run();
