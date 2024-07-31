import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import * as auth from "./authentication";
import * as utils from "./utilities";
import * as ini from "ini";

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
    try {
        // Local feed
        const internalFeed = await auth.getInternalAuthInfoArray("artifactFeed");

        // external service endpoint
        const externalEndpoints = await auth.getExternalAuthInfoArray("pythonUploadServiceConnection");

        // combination of both internal and external
        const newEndpointsToAdd = new Set([...internalFeed, ...externalEndpoints]);

        let pypircPath = utils.getPypircPath();

        // create new file. We do not merge existing files and always create a fresh file
        if (!tl.getVariable("PYPIRC_PATH") || !tl.exist(tl.getVariable("PYPIRC_PATH"))) {
            fs.writeFileSync(pypircPath, formPypircFormatFromData(newEndpointsToAdd));
            tl.setVariable("PYPIRC_PATH", pypircPath, false);
            tl.debug(tl.loc("VariableSetForPypirc", pypircPath));
        }
        else {
            pypircPath = tl.getVariable("PYPIRC_PATH");
            const pypirc = fs.readFileSync(pypircPath, 'utf8');
            let fileContent = ini.parse(pypirc);

            let usedRepos = new Set<string>();

            for (let connection in fileContent) {

                const connectionObj: object = fileContent[connection];

                if (!connectionObj.hasOwnProperty('repository')) {
                    const authenticatedRepo = getNestedRepoProperty(connectionObj);

                    if (authenticatedRepo === undefined) {
                        tl.warning(tl.loc("NoRepoFound", connection));
                        continue;
                    }

                    usedRepos.add(authenticatedRepo);
                    continue;
                }

                usedRepos.add(connectionObj['repository']);
            }

            let reposList: string[] = [];

            for (let entry of newEndpointsToAdd) {

                tl.debug(tl.loc("Info_AddingAuthForRegistry", entry.packageSource.feedName));

                if (entry.packageSource.feedName in fileContent){
                    tl.warning(tl.loc("DuplicateRegistry", entry.packageSource.feedName));
                    removeFromFeedCount(internalFeed, externalEndpoints, entry);
                    continue;
                }

                let repo = new Repository(
                    entry.packageSource.feedName,
                    entry.packageSource.feedUri,
                    entry.username,
                    entry.password
                );

                if (usedRepos.has(repo.repository)) {
                    tl.warning(tl.loc("DuplicateRepoUrl", repo.repository));
                    removeFromFeedCount(internalFeed, externalEndpoints, entry);
                    continue;
                }

                reposList.push(repo.toString() + `${os.EOL}`);

                fileContent["distutils"]["index-servers"] += " " + entry.packageSource.feedName;
            }

            let encodedStr = ini.encode(fileContent);
            fs.writeFileSync(pypircPath, encodedStr);

            fs.appendFileSync(pypircPath, `${os.EOL}`, 'utf8');

            for (let repo of reposList) {
                fs.appendFileSync(pypircPath, repo, 'utf8');
            }
        }

        // Configuring the pypirc file
        internalFeedSuccessCount = internalFeed.size;
        externalFeedSuccessCount = externalEndpoints.size;
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

// only used for new file writes.
function formPypircFormatFromData(authInfoSet: Set<auth.AuthInfo>): string{
    const authInfo = Array.from(authInfoSet);
    let feedNames = authInfo.map(entry => entry.packageSource.feedName);
    let duplicateFeeds = findDuplicatesInArray<string>(feedNames);

    if (duplicateFeeds.length > 0) {
        throw new Error(tl.loc("Error_DuplicateEntryForFeed", duplicateFeeds.join(", ")));
    }

    feedNames.forEach(feedName =>
        console.log(tl.loc("Info_AddingAuthForRegistry", feedName)))
    let header = `[distutils]${os.EOL}index-servers=${feedNames.join(" ")}`;
    header += `${os.EOL}`

    let repositories = authInfo.map(entry => 
        new Repository(entry.packageSource.feedName, entry.packageSource.feedUri, 
            entry.username, entry.password));
    let repositoriesEncodedStr = repositories.map(repo => repo.toString()).join(os.EOL);

    return header + os.EOL + repositoriesEncodedStr;
}

main();
