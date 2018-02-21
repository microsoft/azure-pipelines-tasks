import * as fs from 'fs';
import * as path from 'path';
import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { extractCompressedFile } from 'compression-common/FileExtractor';

taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
    try {
        await getJava();
    } catch (error) {
        taskLib.error(error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getJava() {
    const versionSpec = taskLib.getInput('versionSpec', true);
    const architecture = taskLib.getInput('jdkArchitectureOption', true);
    const installationSource = taskLib.getInput('jdkSourceOption', true);
    const destination = taskLib.getPathInput('jdkDestinationDirectory', true);
    const cleanDestination = taskLib.getBoolInput('cleanDestinationDirectory', false);

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Java');
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
            console.log(taskLib.loc('RetrievingJdkFromAzure', versionSpec, architecture));
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
            console.log(taskLib.loc('RetrievingJdkFromFilePath', versionSpec, architecture));
            return taskLib.getInput('jdkFile', true);
        } else {
            throw new Error(taskLib.loc("InstallationSourceUnknown", installationSource));
        }
    })();

    const extractedContents = await extractCompressedFile(compressedFile, destination, process.platform);
    toolLib.debug(`Extracted contents: ${extractedContents}`);
    taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));

    unpackJars(extractedContents, path.join(extractedContents, 'bin'));

    const extendedJavaHome = 'JAVA_HOME_' + versionSpec + '_' + architecture;
    console.log(taskLib.loc('SetJavaHome', extractedContents));
    console.log(taskLib.loc('SetExtendedJavaHome', extendedJavaHome, extractedContents));
    taskLib.setVariable('JAVA_HOME', extractedContents);
    taskLib.setVariable(extendedJavaHome, extractedContents);
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(resolve, milliseconds);
    });
}

/** Recursively find all .pack files under `rootDir` and unpack them with the unpack200 tool. */
function unpackJars(rootDir: string, javaBinPath: string): void {
    if (fs.existsSync(rootDir)) {
        if (fs.lstatSync(rootDir).isDirectory()) {
            for (let file of fs.readdirSync(rootDir)) {
                const curPath = path.join(rootDir, file);
                unpackJars(curPath, javaBinPath);
            }
        } else if (path.extname(rootDir).toLowerCase() === '.pack') {
            // Unpack the pack file synchronously
            const p = path.parse(rootDir);
            const isWindows = process.platform === 'win32';

            const toolName = isWindows ? 'unpack200.exe' : 'unpack200';
            const args = isWindows ? '-r -v -l ""' : '';
            const name = path.join(p.dir, p.name);
            taskLib.execSync(path.join(javaBinPath, toolName), `${args} "${name}.pack" "${name}.jar"`);
        }
    }
}

run();
