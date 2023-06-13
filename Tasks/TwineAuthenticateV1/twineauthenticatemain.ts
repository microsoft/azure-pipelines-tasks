import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import * as auth from "./authentication";
import * as utils from "./utilities";

 // tslint:disable-next-line:max-classes-per-file
export class Repository
{
    public feedName: string;
    public repository: string;
    public username: string;
    public password: string;

    constructor(feedName: string, repository: string, username: string, password: string)
    {
        this.feedName = feedName
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
    try {
        // Local feed
        const internalFeed = await auth.getInternalAuthInfoArray("artifactFeed");

        // external service endpoint
        const externalEndpoints = await auth.getExternalAuthInfoArray("pythonUploadServiceConnection");

        // combination of both internal and external
        const newEndpointsToAdd = internalFeed.concat(externalEndpoints);

        let pypircPath = utils.getPypircPath();

        // create new file. We do not merge existing files and always create a fresh file
        fs.writeFileSync(pypircPath, formPypircFormatFromData(newEndpointsToAdd));
        tl.setVariable("PYPIRC_PATH", pypircPath, false);
        tl.debug(tl.loc("VariableSetForPypirc", pypircPath));

        // Configuring the pypirc file
        internalFeedSuccessCount = internalFeed.length;
        externalFeedSuccessCount = externalEndpoints.length;
        console.log(tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount));
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    } finally{
        emitTelemetry("Packaging", "TwineAuthenticateV1", {
            "InternalFeedAuthCount": internalFeedSuccessCount,
            "ExternalFeedAuthCount": externalFeedSuccessCount,
        });
    }
}

function findDuplicatesInArray<T>(array: Array<T>): Array<T>{
    return array.filter((e, i, a) => a.indexOf(e) !== i);
}

// only used for new file writes.
function formPypircFormatFromData(authInfo: auth.AuthInfo[]): string{
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

    let repositoriesEncodedStr = repositories.map(repo => repo.toString()).join(os.EOL);

    return header + os.EOL + repositoriesEncodedStr;
}

main();
