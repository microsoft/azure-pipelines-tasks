import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import * as auth from "./authentication";
import * as utils from "./utilities";

#if WIF
import { getFederatedWorkloadIdentityCredentials, getFeedTenantId } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils"
#endif

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
        return `[${this.feedName}]${os.EOL}repository=${this.repository}${os.EOL}username=${this.username}${os.EOL}password=${this.password}`;
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

#if WIF
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
        const feedUrl = tl.getInput("feedUrl");

        if (entraWifServiceConnectionName && feedUrl) {
            const urlPieces = feedUrl.split('/');
            let feedName = '';
            urlPieces[urlPieces.length - 1] === '' ? feedName = urlPieces[urlPieces.length - 4] : feedName = urlPieces[urlPieces.length - 3];

            const feedTenant = await getFeedTenantId(feedUrl);
            const token = await getFederatedWorkloadIdentityCredentials(entraWifServiceConnectionName, feedTenant);

            if (token) {
                tl.debug(tl.loc("Info_AddingAuthForRegistry", feedName));
                const header = `[distutils]${os.EOL}index-servers=${feedName}`;
                const wifRepo = new Repository(feedName, feedUrl, entraWifServiceConnectionName, token);
                fs.writeFileSync(pypircPath, header + os.EOL + os.EOL + wifRepo.toString());
                federatedFeedSuccessCount++;
                setPypircEnvVar(pypircPath);
                console.log(tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount, federatedFeedSuccessCount));
            }
            else {
                throw new Error(tl.loc("Error_FailedToGetServiceConnectionAuth", entraWifServiceConnectionName));
            }

            return;
        }
        else if (entraWifServiceConnectionName || feedUrl) {
            throw new Error(tl.loc("Error_MissingFeedUrlOrServiceConnection"));
        }
#endif

        // create new file. We do not merge existing files and always create a fresh file
        fs.writeFileSync(pypircPath, formPypircFormatFromData(newEndpointsToAdd));
        setPypircEnvVar(pypircPath);

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

function findDuplicatesInArray<T>(array: Array<T>): Array<T>{
    return array.filter((e, i, a) => a.indexOf(e) !== i);
}

function formPypircFormatFromData(authInfoSet: Set<auth.AuthInfo>): string {
    const authInfo = Array.from(authInfoSet);
    let feedNames = authInfo.map(entry => entry.packageSource.feedName);
    let duplicateFeeds = findDuplicatesInArray<string>(feedNames);

    if (duplicateFeeds.length > 0) {
        throw new Error(tl.loc("Error_DuplicateEntryForFeed", duplicateFeeds.join(", ")));
    }

    feedNames.forEach(feedName =>
        console.log(tl.loc("Info_AddingAuthForRegistry", feedName)))
    let header = `[distutils]${os.EOL}index-servers=${feedNames.join(" ")}`;

    let repositories = authInfo.map(entry =>
        new Repository(entry.packageSource.feedName, entry.packageSource.feedUri,
            entry.username, entry.password));

    let repositoriesEncodedStr = repositories.map(repo => repo.toString()).join(`${os.EOL}${os.EOL}`);

    return header + os.EOL + os.EOL + repositoriesEncodedStr;
}

function setPypircEnvVar(pypircPath: string): void {
    tl.setVariable("PYPIRC_PATH", pypircPath, false);
    tl.debug(tl.loc("VariableSetForPypirc", pypircPath));
}

main();
