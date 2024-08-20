import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import * as auth from "./authentication";
import * as utils from "./utilities";
import * as ini from "ini";

import { getFederatedWorkloadIdentityCredentials, getFeedTenantId } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils"

 // tslint:disable-next-line:max-classes-per-file
export class Repository
{
    public feedName: string;
    public repository: string;
    public username: string;
    public password: string;

    constructor(feedName: string, repository: string, username: string, password: string)
    {
        this.feedName = feedName;
        this.repository = repository;
        this.username = username;
        this.password = password;
    }

    toString()
    {
        return `[${this.feedName}]${os.EOL}repository=${this.repository}${os.EOL}username=${this.username}${os.EOL}password=${this.password}${os.EOL}`;
    }
}

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));
    tl.setResourcePath(path.join(__dirname, "node_modules/azure-pipelines-tasks-artifacts-common/module.json"));

    let internalFeedSuccessCount: number = 0;
    let externalFeedSuccessCount: number = 0;
    let federatedFeedSuccessCount: number = 0;
    try {
        // Local feed
        const internalFeed = await auth.getInternalAuthInfoArray("artifactFeed");

        // external service endpoint
        const externalEndpoints = await auth.getExternalAuthInfoArray("pythonUploadServiceConnection");

        // combination of both internal and external
        const newEndpointsToAdd = new Set([...internalFeed, ...externalEndpoints]);

        let pypircPath = utils.getPypircPath();

        // create new .pypirc file if one does not exist yet
        if (!tl.getVariable("PYPIRC_PATH") || !tl.exist(tl.getVariable("PYPIRC_PATH")) || !tl.exist(pypircPath)) {
            fs.writeFileSync(pypircPath, '', 'utf8');
            tl.setVariable("PYPIRC_PATH", pypircPath, false);
            tl.debug(tl.loc("VariableSetForPypirc", pypircPath));
        }
        
        const pypirc = fs.readFileSync(pypircPath, 'utf8');

        let fileContent = ini.parse(pypirc);

        let usedRepos = new Set<string>();

        for (let connection in fileContent) {

            const connectionObj: object = fileContent[connection];

            if (!connectionObj.hasOwnProperty('repository')) {
                const authenticatedRepo = getNestedRepoProperty(connectionObj);

                if ((authenticatedRepo === undefined) && (connection.toLocaleLowerCase() !== 'distutils')) {
                    tl.warning(tl.loc("NoRepoFound", connection));
                    continue;
                }

                usedRepos.add(authenticatedRepo);
                continue;
            }

            usedRepos.add(connectionObj['repository']);
        }

        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
        const feedUrl = tl.getInput("feedUrl");

        if (entraWifServiceConnectionName && feedUrl) {
            const urlPieces = feedUrl.split('/');
            let feedName = '';
            urlPieces.at(-1) === '' ? feedName = urlPieces.at(-4) : feedName = urlPieces.at(-3);

            // First, check that repo is not a duplicate
            if ((feedName in fileContent) || (usedRepos.has(feedUrl))) {
                console.log(tl.loc("Warning_DuplicateEntryForFeed", feedName, feedUrl));
                return;
            }

            fileContent = configHeader(fileContent, feedName);

            let encodedStr = ini.encode(fileContent);
            fs.writeFileSync(pypircPath, encodedStr + os.EOL, 'utf8');

            const feedTenant = await getFeedTenantId(feedUrl);
            const token = await getFederatedWorkloadIdentityCredentials(entraWifServiceConnectionName, feedTenant);

            if (token) {
                tl.debug(tl.loc("Info_AddingAuthForRegistry", feedName));
                const wifRepo = new Repository(feedName, feedUrl, entraWifServiceConnectionName, token);
                fs.appendFileSync(pypircPath, os.EOL + wifRepo.toString(), 'utf8');
                federatedFeedSuccessCount++;
                console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedName));
            }
            else {
                throw new Error(tl.loc("Error_FailedToGetServiceConnectionAuth", entraWifServiceConnectionName));
            }

            return;
        }
        else if (entraWifServiceConnectionName || feedUrl) {
            throw new Error(tl.loc("Error_MissingFeedUrlOrServiceConnection"));
        }

        let reposList: string[] = [];

        for (let entry of newEndpointsToAdd) {

            tl.debug(tl.loc("Info_AddingAuthForRegistry", entry.packageSource.feedName));

            let repo = new Repository(
                entry.packageSource.feedName,
                entry.packageSource.feedUri,
                entry.username,
                entry.password
            );

            if ((entry.packageSource.feedName in fileContent) || (usedRepos.has(repo.repository))) {
                console.log(tl.loc("Warning_DuplicateEntryForFeed", entry.packageSource.feedName, repo.repository));
                removeFromFeedCount(internalFeed, externalEndpoints, entry);
                continue;
            }

            reposList.push(repo.toString() + `${os.EOL}`);
            
            fileContent = configHeader(fileContent, entry.packageSource.feedName);
        }

        let encodedStr = ini.encode(fileContent);
        fs.writeFileSync(pypircPath, encodedStr);

        fs.appendFileSync(pypircPath, `${os.EOL}`, 'utf8');

        for (let repo of reposList) {
            fs.appendFileSync(pypircPath, repo, 'utf8');
        }

        // Configuring the pypirc file
        internalFeedSuccessCount = internalFeed.size;
        externalFeedSuccessCount = externalEndpoints.size;
        console.log(tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount, federatedFeedSuccessCount));
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    } finally{
        emitTelemetry("Packaging", "TwineAuthenticateV1", {
            "InternalFeedAuthCount": internalFeedSuccessCount,
            "ExternalFeedAuthCount": externalFeedSuccessCount,
            "FederatedFeedAuthCount": federatedFeedSuccessCount,
        });
    }
}

function configHeader(fileContent: any, feedName: string): any {
    (!fileContent.hasOwnProperty("distutils") || !fileContent["distutils"].hasOwnProperty("index-servers")) ?
        fileContent["distutils"] = {["index-servers"]: `${feedName}`} :
        fileContent["distutils"]["index-servers"] += " " + feedName;
    return fileContent;
}

function removeFromFeedCount(internalFeed: Set<auth.AuthInfo>, externalEndpoints: Set<auth.AuthInfo>, entry: auth.AuthInfo): void {
    if (internalFeed.has(entry)) {
        internalFeed.delete(entry);
        return;
    }
    externalEndpoints.delete(entry);
}

function getNestedRepoProperty(connection: object): string | undefined {
    for (const key in connection) {
        if (typeof connection[key] === 'object') {
            return getNestedRepoProperty(connection[key]);
        }
        else if (key.toLowerCase() === 'repository') {
            return connection[key];
        }
    }
    return undefined;
}

main();
