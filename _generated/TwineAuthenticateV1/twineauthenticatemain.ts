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
    public repository: string;
    public username: string;
    public password: string;

    constructor(repository: string, username: string, password: string)
    {
        this.repository = repository;
        this.username = username;
        this.password = password;
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
        if (!tl.getVariable("PYPIRC_PATH")) {
            fs.writeFileSync(pypircPath, formPypircFormatFromData(newEndpointsToAdd));
            tl.setVariable("PYPIRC_PATH", pypircPath, false);
            tl.debug(tl.loc("VariableSetForPypirc", pypircPath));
        }
        else {
            const pypirc = fs.readFileSync(tl.getVariable("PYPIRC_PATH"), 'utf8');
            let fileContent = ini.parse(fs.readFileSync(pypircPath, "utf-8"));

            for (let entry of newEndpointsToAdd) {

                tl.debug(tl.loc("Info_AddingAuthForRegistry", entry.packageSource.feedName));

                if (entry.packageSource.feedName in fileContent){
                    tl.debug(tl.loc("DuplicateRegistry", entry.packageSource.feedName));
                    if (internalFeed.includes(entry)) {
                        internalFeed.pop();
                        continue;
                    }
                    externalEndpoints.pop();
                    continue;
                }

                fileContent[entry.packageSource.feedName] = new Repository(
                    entry.packageSource.feedUri,
                    entry.username,
                    entry.password
                );

                fileContent["distutils"]["index-servers"] += " " + entry.packageSource.feedName;
            }

            let encodedStr = ini.encode(fileContent);
            fs.writeFileSync(pypircPath, encodedStr);
        }

        // Configuring the pypirc file
        internalFeedSuccessCount = internalFeed.length;
        externalFeedSuccessCount = externalEndpoints.length;
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Info_SuccessAddingAuth", internalFeedSuccessCount, externalFeedSuccessCount));
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

    let entries = {}

    authInfo.forEach(entry => 
        { entries[entry.packageSource.feedName] = new Repository(
            entry.packageSource.feedUri, 
            entry.username, 
            entry.password) 
        }
    );

    const repositoriesEncodedStr = ini.encode(entries);

    return header + os.EOL + repositoriesEncodedStr;
}

main();
