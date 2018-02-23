import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

import request = require('request');

import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { extractCompressedFile } from 'compression-common/FileExtractor';

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
     if (cleanDestination && fs.existsSync(destination) && fs.statSync(destination).isDirectory()) {
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
            return path.join(destination, filename!);
        } else if (installationSource === 'FilePath') {
            console.log(taskLib.loc('RetrievingPythonFromFilePath', versionSpec, architecture));
            return taskLib.getInput('compressedFile', true);
        } else if (installationSource === 'Url') {
            console.log(taskLib.loc('RetrievingPythonFromUrl', versionSpec, architecture));

            const downloadUrl = url.parse(taskLib.getInput('url')); // TODO Node v6.13: use new URL API
            if (!downloadUrl.protocol) {
                throw new Error(taskLib.loc('UrlNoProtocol', downloadUrl.href));
            }
            if (!downloadUrl.host) {
                throw new Error(taskLib.loc('UrlNoHost', downloadUrl.href));
            }

            const path = downloadUrl.pathname;
            if (!path) {
                throw new Error(taskLib.loc('UrlNoFile', downloadUrl.href));
            }

            const outputFile = path.split('/').pop();
            if (!outputFile) {
                throw new Error(taskLib.loc('UrlNoFile', downloadUrl.href));
            }

            await toPromise(request(downloadUrl.href!).pipe(fs.createWriteStream(outputFile)));
            return outputFile;
        } else {
            throw new Error(taskLib.loc("InstallationSourceUnknown", installationSource));
        }
    })();

    const extractedContents = await extractCompressedFile(compressedFile, destination, process.platform);
    toolLib.debug(`Extracted contents: ${extractedContents}`);
    taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));

    const outputVariable = taskLib.getInput('outputVariable');
    taskLib.debug(`Set output variable ${outputVariable} to ${extractedContents}`);
    taskLib.setVariable(outputVariable, extractedContents);
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(resolve, milliseconds);
    });
}

function toPromise(stream: fs.WriteStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        stream.on('close', resolve);
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
}

run();
