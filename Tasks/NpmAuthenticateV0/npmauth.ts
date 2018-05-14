import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as URL from 'url';
import * as fs from 'fs';
import * as constants from './constants';
import * as npmregistry from 'npm-common/npmregistry'
import * as util from 'npm-common/util';
import * as os from 'os';
import * as npmrcparser from 'npm-common/npmrcparser';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let saveNpmrcPath: string;
    let npmrc = tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile);
    let workingDirectory = path.dirname(npmrc);
    if (!(npmrc.endsWith('.npmrc'))) {
        throw new Error(tl.loc('NpmrcNotNpmrc', npmrc));
    }
    else if (!tl.exist(npmrc)) {
        throw new Error(tl.loc('NpmrcDoesNotExist', npmrc));
    }
    else {
        console.log(tl.loc("AuthenticatingThisNpmrc", npmrc));
    }

    if (tl.getVariable("SAVE_NPMRC_PATH")) {
         saveNpmrcPath = tl.getVariable("SAVE_NPMRC_PATH");
    }
    else {
        let tempPath = tl.getVariable('Agent.BuildDirectory') || tl.getVariable('Agent.ReleaseDirectory') || process.cwd();
        tempPath = path.join(tempPath, 'npmAuthenticate');
        tl.mkdirP(tempPath);
        saveNpmrcPath = fs.mkdtempSync(tempPath + path.sep); 
        tl.setVariable("SAVE_NPMRC_PATH", saveNpmrcPath, false);
        tl.setVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY", tempPath, false);
    }
    let npmrcTable: Object;

    //The index file is a json object that keeps track of where .npmrc files are saved.
    //There is a key-value pairing of filepaths of original npmrc files to IDs.
    //This is important so multiple runs of the npm Authenticate task on the same .npmrc file actually reverts to the original after the build completes.
    let indexFile = path.join(saveNpmrcPath, 'index.json');

    if (fs.existsSync(indexFile)) { //If the file exists, add to it.
        npmrcTable = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
        
    }
    else { //If the file doesn't exist, create it. 
        npmrcTable = new Object();
        npmrcTable['index'] = 0;
    }

    if (npmrcTable[npmrc] === undefined) {
        npmrcTable[npmrc] = npmrcTable['index'];
        npmrcTable['index']++;
        fs.writeFileSync(indexFile, JSON.stringify(npmrcTable));
        util.saveFileWithName(npmrc, npmrcTable[npmrc], saveNpmrcPath);
    }

    let endpointRegistries;
    let endpointIds = tl.getDelimitedInput(constants.NpmAuthenticateTaskInput.CustomEndpoint, ',');
    if (endpointIds && endpointIds.length > 0) {
        endpointRegistries = endpointIds.map(e => npmregistry.NpmRegistry.FromServiceEndpoint(e, true));
    }
    let LocalNpmRegistries = await util.getLocalNpmRegistries(workingDirectory);
    
    
    let npmrcFile = fs.readFileSync(npmrc, 'utf8').split(os.EOL);
    for (let RegistryURLString of npmrcparser.GetRegistries(npmrc)) {
        let registryURL = URL.parse(RegistryURLString);
        let registry: npmregistry.NpmRegistry;
        if (endpointRegistries && endpointRegistries.length > 0) {
            for (let serviceEndpoint of endpointRegistries) {
                
                if (util.toNerfDart(serviceEndpoint.url) == util.toNerfDart(RegistryURLString)) {
                    let serviceURL = URL.parse(serviceEndpoint.url);              
                    console.log(tl.loc("AddingEndpointCredentials", registryURL.host));
                    registry = serviceEndpoint;
                    npmrcFile = clearFileOfReferences(npmrc, npmrcFile, serviceURL);
                    break;
                }
            }
        }
        if (!registry) {
            for (let localRegistry of LocalNpmRegistries) {
                if (util.toNerfDart(localRegistry.url) == util.toNerfDart(RegistryURLString)) {
                    let localURL = URL.parse(localRegistry.url);
                    console.log(tl.loc("AddingLocalCredentials"));
                    registry = localRegistry;
                    npmrcFile = clearFileOfReferences(npmrc, npmrcFile, localURL);
                    break;
                }
            }
        }
        if (registry) {
            tl.debug(tl.loc('AddingAuthRegistry', registry.url));
            util.appendToNpmrc(npmrc, os.EOL + registry.auth + os.EOL);
            npmrcFile.push(os.EOL + registry.auth + os.EOL);
        }
        else {
            console.log(tl.loc("IgnoringRegistry", registryURL.host ));
        }
    }
}


main().catch(error => {
    tl.rmRF(util.getTempPath());
    tl.setResult(tl.TaskResult.Failed, error);
});
function clearFileOfReferences(npmrc: string, file: string[], url: URL.Url) {
    let redoneFile = file;
    let warned = false;
    for (let i = 0; i < redoneFile.length; i++) {
        if (file[i].indexOf(url.host) != -1 && file[i].indexOf(url.path) != -1 && file[i].indexOf('registry=') == -1) {
            if (!warned) {
                tl.warning(tl.loc('CheckedInCredentialsOverriden', url.host));
            }
            warned = true;
            redoneFile[i] = '';
        }
    }
    fs.writeFileSync(npmrc, redoneFile.join(os.EOL));
    return redoneFile;
}

