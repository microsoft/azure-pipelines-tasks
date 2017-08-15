import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as URL from 'url';
import * as fs from 'fs';
import * as constants_1 from './constants';
import * as npmregistry_1 from 'npm-common/npmregistry'
import * as util from 'npm-common/util';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let saveNpmrcPath;
    let npmrc = tl.getInput(constants_1.NpmAuthenticateTaskInput.WorkingDir);
    let workingDir = path.dirname(npmrc);
    if (!(npmrc.endsWith('.npmrc') && tl.exist(npmrc))) {
        throw new Error(tl.loc('NpmrcNotNpmrc', npmrc));
    }
    else {
        console.log(tl.loc("AuthenticatingThisNpmrc", npmrc));
    }

    if (process.env.SAVE_NPMRC_PATH) {
         saveNpmrcPath = process.env.SAVE_NPMRC_PATH
    }
    else {
        let tempPath = tl.getVariable('Agent.BuildDirectory') || tl.getVariable('Agent.ReleaseDirectory') || process.cwd();
        tempPath = path.join(tempPath, 'npmAuthenticate');
        tl.mkdirP(tempPath);
        saveNpmrcPath = fs.mkdtempSync(tempPath + path.sep); 
        console.log("##vso[task.setvariable variable=SAVE_NPMRC_PATH;]" + saveNpmrcPath);
        console.log("##vso[task.setvariable variable=NPM_AUTHENTICATE_TEMP_DIRECTORY;]" + tempPath);
        
    }
    let npmrcTable;

    //The index file is a json object that keeps track of where .npmrc files are saved.
    //There is a key-value pairing of filepaths of original npmrc files to IDs.
    //This is important so multiple runs of the npm Authenticate task on the same .npmrc file actually reverts to the original after the build completes.
    let indexFile = saveNpmrcPath+'\\index.json';

    if (fs.existsSync(indexFile)) { //If the file exists, add to it.
        npmrcTable = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
        if (npmrcTable[npmrc]=== undefined) {
            npmrcTable[npmrc] = npmrcTable['index'];
            npmrcTable['index']++;
            fs.writeFileSync(indexFile, JSON.stringify(npmrcTable));
            util.saveFileWithName(npmrc, npmrcTable[npmrc], saveNpmrcPath);
        }
    }
    else { //If the file doesn't exist, create it. 
        npmrcTable = new Object();
        npmrcTable['index']=0;
        npmrcTable[npmrc] = npmrcTable['index'];
        npmrcTable['index']++;
        fs.writeFileSync(indexFile, JSON.stringify(npmrcTable));
        util.saveFileWithName(npmrc, '0', saveNpmrcPath);

    }

    let endpointRegistries;
    let endpointIds = tl.getDelimitedInput(constants_1.NpmAuthenticateTaskInput.CustomEndpoint, ',');
    if (endpointIds && endpointIds.length > 0) {
        endpointRegistries = endpointIds.map(e => npmregistry_1.NpmRegistry.FromServiceEndpoint(e, true));
    }
    let LocalNpmRegistries = await util.getLocalNpmRegistries(workingDir);
    
    
    let npmrcFile = fs.readFileSync(npmrc, 'utf8').split('\n');
    for (let fileLine of npmrcFile) {
        //For each registry in the .npmrc file (every line with "registry=")
        //If it's got a service endpoint, use that. If not, use a local registry.
        //If it's got one of those, add the credentials into the .npmrc file
        if (fileLine.search('registry=') > -1) {  
            let keyAndValue = fileLine.split('=');
            let registryURL = URL.parse(keyAndValue[1]);
            let registry;
            if (endpointRegistries && endpointRegistries.length > 0) {
                for (let serviceEndpoint of endpointRegistries) {
                    let serviceURL = URL.parse(serviceEndpoint.url);
                    if (serviceURL.hostname == registryURL.hostname) {
                        console.log(tl.loc("AddingEndpointCredentials", registryURL.hostname));
                        registry = serviceEndpoint;
                        npmrcFile = clearFileOfReferences(npmrc, npmrcFile, serviceURL);
                        break;
                    }
                }
            }
            if (!registry) {
                for (let localRegistry of LocalNpmRegistries) {
                    let localURL = URL.parse(localRegistry.url);
                    if (localURL.hostname == registryURL.hostname) {
                        console.log(tl.loc("AddingLocalCredentials"))
                        registry = localRegistry;
                        npmrcFile = clearFileOfReferences(npmrc, npmrcFile, localURL);
                        break;
                    }
                }
            }
            if (registry) {
                if (registry.authOnly === false) {
                    tl.debug(tl.loc('UsingRegistry', registry.url));
                    util.appendToNpmrc(npmrc, `registry=${registry.url}\n`);
                }
                tl.debug(tl.loc('AddingAuthRegistry', registry.url));
                util.appendToNpmrc(npmrc, `${registry.auth}\n`);
                npmrcFile.push(`${registry.auth}\n`);
            }
            else {
                console.log(tl.loc("IgnoringRegistry", registryURL.hostname ));
            }
        }
    }
}


main().catch(error => {
    tl.rmRF(util.getTempPath());
    tl.setResult(tl.TaskResult.Failed, error);
});


function clearFileOfReferences(npmrc, file, url) {
    let redoneFile = file;
    let warned = false;
    for (let i = 0; i < redoneFile.length; i++) {
        if (file[i].search(url.hostname) != -1 && file[i].search('registry=') == -1) {
            if (!warned) {
                tl.warning(tl.loc('CheckedInCredentialsOverriden', url.hostname));
            }
            warned = true;
            redoneFile[i] = '';
        }
    }
    fs.writeFileSync(npmrc, redoneFile.join(''));
    return redoneFile;
}

