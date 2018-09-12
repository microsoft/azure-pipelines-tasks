import * as fs from 'fs';
import * as os from 'os';
import path = require('path');
import taskLib = require('vsts-task-lib/task');
import * as tr from 'vsts-task-lib/toolrunner';
import toolLib = require('vsts-task-tool-lib/tool');

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
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
    const fromAzure: boolean = ('AzureStorage' == taskLib.getInput('jdkSourceOption', true));
    const extractLocation: string = taskLib.getPathInput('jdkDestinationDirectory', true);
    const cleanDestDir: boolean = taskLib.getBoolInput('cleanDestinationDirectory', false);
    let compressedFileExtension: string;
    let jdkDirectory: string;

    toolLib.debug('Trying to get tool from local cache first');
    const localVersions: string[] = toolLib.findLocalToolVersions('Java');
    const version: string = toolLib.evaluateVersions(localVersions, versionSpec);

    if (version) { //This version of Java JDK is already in the cache. Use it instead of downloading again.
        console.log(taskLib.loc('Info_ResolvedToolFromCache', version));
    } else if ('AzureStorage' == taskLib.getInput('jdkSourceOption', true)) { //Download JDK from an Azure blob storage location and extract.
        console.log(taskLib.loc('RetrievingJdkFromAzure'));
        cleanDestinationDirectory(cleanDestDir, extractLocation);

        const fileNameAndPath: string = taskLib.getInput('azureCommonVirtualFile', false);
        compressedFileExtension = getFileEnding(fileNameAndPath);

        const azureDownloader = new AzureStorageArtifactDownloader(taskLib.getInput('azureResourceManagerEndpoint', true),
            taskLib.getInput('azureStorageAccountName', true), taskLib.getInput('azureContainerName', true), "");
        await azureDownloader.downloadArtifacts(extractLocation, '*' + fileNameAndPath);
        await sleepFor(250); //Wait for the file to be released before extracting it.

        const extractSource = buildFilePath(extractLocation, compressedFileExtension, fileNameAndPath);
        const javaFilesExtractor = new JavaFilesExtractor();
        jdkDirectory = await javaFilesExtractor.unzipJavaDownload(extractSource, compressedFileExtension, extractLocation);
    } else if ('LocalDirectory' == taskLib.getInput('jdkSourceOption', true)) { //JDK is in a local directory. Extract to specified target directory.
        console.log(taskLib.loc('RetrievingJdkFromLocalPath'));
        cleanDestinationDirectory(cleanDestDir, extractLocation);

        compressedFileExtension = getFileEnding(taskLib.getInput('jdkFile', true));
        const javaFilesExtractor = new JavaFilesExtractor();
        jdkDirectory = await javaFilesExtractor.unzipJavaDownload(taskLib.getInput('jdkFile', true), compressedFileExtension, extractLocation);
    } else if ('AptGet' == taskLib.getInput('jdkSourceOption', true)) { //Install JDK via apt-get
        //Check that it is Linux. Apt-get does not work on all Linux distributions, however we have no way of checking which one is being used.
        if(os.platform() === 'linux') {
            let escapedScript = path.join(__dirname, 'aptGetJavaInstall.sh').replace(/'/g, "''");
            fs.chmodSync(escapedScript, "777");

            let scriptRunner = taskLib.tool(taskLib.which('bash', true))
            .arg('--noprofile')
            .arg(`--norc`)
            .arg(escapedScript)
            .arg(`${versionSpec}`);
                
            let result: tr.IExecSyncResult = scriptRunner.execSync();
            if (result.code != 0) {
                throw taskLib.loc("AptGetFailed", result.error ? result.error.message : result.stderr);
            }

            setEnvironmentVars(versionSpec, '/usr/lib/jvm/java-' + versionSpec + '-openjdk-amd64');
        } else {
            console.log(taskLib.loc('NotLinuxPlatform'));
            console.log(taskLib.loc('CurrentPlatformInfo', os.platform()));
        }
    } else { //Install JDK via chocolatey command
        //check that it is Windows
        if(os.platform() === 'win32') {
            let filePath = path.join(__dirname, 'chocoJavaInstall.ps1').replace("'", "''");
            let command = `. '${filePath}' -VersionSpec '${versionSpec}'`;
            let powershell = taskLib.tool(taskLib.which('pwsh') || taskLib.which('powershell') || taskLib.which('pwsh', true))
                .arg('-NoLogo')
                .arg('-NoProfile')
                .arg('-NonInteractive')
                .arg('-Command')
                .arg(command);
            const options: tr.IExecOptions = <any>{
                failOnStdErr: false,
                errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
                outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
                ignoreReturnCode: true
            };

            let exitCode: number = await powershell.exec(options);

            // Fail on exit code.
            if (exitCode !== 0) {
                taskLib.setResult(taskLib.TaskResult.Failed, taskLib.loc('JS_ExitCode', exitCode));
                console.log(taskLib.loc('CurrentPlatformInfo', os.platform()));
            }
        } else {
            console.log(taskLib.loc('NotWindowsPlatform'));
        }
    }
}

function cleanDestinationDirectory(cleanDestDir: boolean, extractLocation: string) {
    // Clean the destination folder before downloading and extracting?
    if (cleanDestDir && taskLib.exist(extractLocation) && taskLib.stats(extractLocation).isDirectory) {
        console.log(taskLib.loc('CleanDestDir', extractLocation));

        // delete the contents of the destination directory but leave the directory in place
        fs.readdirSync(extractLocation)
            .forEach((item: string) => {
                const itemPath = path.join(extractLocation, item);
                taskLib.rmRF(itemPath);
        });
    }
}

function sleepFor(sleepDurationInMillisecondsSeconds): Promise<any> {
    return new Promise((resolve, reeject) => {
        setTimeout(resolve, sleepDurationInMillisecondsSeconds);
    });
}

function buildFilePath(localPathRoot: string, fileEnding: string, fileNameAndPath: string): string {
    const fileName = fileNameAndPath.split(/[\\\/]/).pop();
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

function setEnvironmentVars(versionSpec: string, jdkDirectory: string) {
    let extendedJavaHome = 'JAVA_HOME_' + versionSpec + '_' + taskLib.getInput('jdkArchitectureOption', true);
    console.log(taskLib.loc('SetJavaHome', jdkDirectory));
    console.log(taskLib.loc('SetExtendedJavaHome', extendedJavaHome, jdkDirectory));
    taskLib.setVariable('JAVA_HOME', jdkDirectory);
    taskLib.setVariable(extendedJavaHome, jdkDirectory);
}

run();