import path = require('path');
import taskLib = require('vsts-task-lib/task');
import toolLib = require('vsts-task-tool-lib/tool');
import restm = require('typed-rest-client/RestClient');

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { JavaFilesExtractor } from "./FileExtractor/JavaFilesExtractor";

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        await getJava(versionSpec);
    }
    catch (error) {
        console.error('ERR:' + error.message);
    } 
}

interface IJavaArtifacts {
    artifacts: IJavaArtifact[] 
}

interface IJavaArtifact{
    name: string,
    versions: IJavaVersionInfo[] 
}

interface IJavaVersionInfo {
    version: string,
    url: string 
}

async function getJava(versionSpec: string) {
    toolLib.debug('Trying to get tool from local cache');
    let localVersions: string[] = toolLib.findLocalToolVersions('Java');
    let version: string = toolLib.evaluateVersions(localVersions, versionSpec);
    let fromAzure: boolean = ('AzureStorage' == taskLib.getInput('jdkSource', true));
    let fromLocalDirectory: boolean = ('LocalDirectory' == taskLib.getInput('jdkSource', true));

    if (version) {
        console.log(taskLib.loc("Info_ResolvedToolFromCache", version));
    }
    else if (fromAzure) {
        try {
            taskLib.setResourcePath(path.join(__dirname, 'task.json'));
            
            const serverEndpoint: string = taskLib.getInput('serverEndpoint', true);
            const serverEndpointUrl: string = taskLib.getEndpointUrl(serverEndpoint, false);

            const serverEndpointAuth: taskLib.EndpointAuthorization = taskLib.getEndpointAuthorization(serverEndpoint, false);
            const username: string = serverEndpointAuth['parameters']['username'];
            const password: string = serverEndpointAuth['parameters']['password'];

            const localPathRoot: string = taskLib.getPathInput('destinationFolder', true);
            const itemPattern: string = taskLib.getInput('itemPattern', true);
            const strictSSL: boolean = ('true' !== taskLib.getEndpointDataParameter(serverEndpoint, 'acceptUntrustedCerts', true));

            const cleanDestinationFolder: boolean = taskLib.getBoolInput('cleanDestinationFolder', false);

            // Clean the destination folder before downloading and extracting?
            if (cleanDestinationFolder && taskLib.exist(this.destinationFolder)) {
                console.log(taskLib.loc('CleanDestDir', this.destinationFolder));
                taskLib.rmRF(this.destinationFolder);
            }

            new AzureStorageArtifactDownloader().downloadArtifacts(localPathRoot);
        } catch (err) {
            taskLib.debug(err.message);
            taskLib._writeError(err);
            taskLib.setResult(taskLib.TaskResult.Failed, err.message);
        }

        new JavaFilesExtractor().unzipJavaDownload();
    }
    else if (fromLocalDirectory) {
        //TODO: Might want to add the logic in here, hmmm?
        console.log("I'm in here. HaHaHa.");
        console.log("destinationFolder is: " + taskLib.getPathInput('destinationFolder', true));
        console.log("sourceFolder is: " + taskLib.getInput('fromLocalMachine', true));
        new JavaFilesExtractor().unzipJavaDownload();
    }

    //console.log(taskLib.loc("Info_UsingVersion", version));
    //let toolPath: string = toolLib.findLocalTool('Java', version);
    //taskLib.setVariable('JAVA_HOME', toolPath);
} 
 
run();  