import * as fs from 'fs';
import * as path from 'path';
import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { FileExtractor } from './FileExtractor/FileExtractor';

async function run(): Promise<void> {
    try {
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));
        await getPython();
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getPython(): Promise<void> {
    const versionSpec = taskLib.getInput('versionSpec', true);
    const architecture = taskLib.getInput('architectureOption', true);
    const installationSource = taskLib.getInput('installationSource', true);
    const destination = taskLib.getPathInput('destinationDirectory', true);
    const cleanDestination = taskLib.getBoolInput('cleanDestinationDirectory', false);

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Python');
    const version: string = toolLib.evaluateVersions(localVersions, versionSpec);

     // Clean the destination folder before downloading and extracting?
     if (cleanDestination && taskLib.exist(destination) && fs.statSync(destination).isDirectory()) {
        console.log(taskLib.loc('CleanDestDir', destination));

        // delete the contents of the destination directory but leave the directory in place
        for (let item of fs.readdirSync(destination)) {
            const itemPath = path.join(destination, item);
            taskLib.rmRF(itemPath);
        }
    }

    if (version) {
        // Found in tool cache. Don't set output variable.
        console.log(taskLib.loc('Info_ResolvedToolFromCache', version));
        return;
    }

    const compressedFile: string = await (async () => {
        if (installationSource === 'AzureStorage') {
            console.log(taskLib.loc('RetrievingPythonFromAzure', versionSpec, architecture));
            const file = taskLib.getInput('azureCommonVirtualFile', true);

            const azureDownloader = new AzureStorageArtifactDownloader(
                taskLib.getInput('azureResourceManagerEndpoint', true),
                taskLib.getInput('azureStorageAccountName', true),
                taskLib.getInput('azureContainerName', true),
                file);

            await azureDownloader.downloadArtifacts(destination, '*' + path.extname(file));
            await sleep(250); // Wait for the file to be released before trying to extract it

            const filename = file.split(/[\\\/]/).pop();
            return path.join(destination, filename);
        } else if (installationSource === 'FilePath') {
            console.log(taskLib.loc('RetrievingPythonFromFilePath', versionSpec, architecture));
            return taskLib.getInput('compressedFile', true);
        } else if (installationSource === 'Url') {
            // TODO download from URL
            throw new Error("Not implemented");
        } else {
            // TODO error
            throw new Error();
        }
    })();

    const extractedContents = await new FileExtractor().extractCompressedFile(compressedFile, destination);
    console.log(`Extracted contents: ${extractedContents}`);

    // TODO
    // taskLib.debug(`Set output variable ${x} to ${y}`);
    // taskLib.setVariable(x, y);
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(resolve, milliseconds);
    });
}

run();
