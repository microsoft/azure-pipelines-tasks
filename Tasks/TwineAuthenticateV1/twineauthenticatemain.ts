import * as fs from "fs";
import * as ini from "ini";
import * as os from "os";
import * as path from "path";
import * as util from "util";
import * as tl from "azure-pipelines-task-lib";
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';
import * as auth from "./authentication";
import * as utils from "./utilities";

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

// only used for new file writes.
function formPypircFormatFromData(authInfo: auth.AuthInfo[]): string{
    let ent : {} = {};

    let header = util.format("[distutils]%sindex-servers=", os.EOL);

    for(let entry of authInfo) {
        console.log(tl.loc("Info_AddingAuthForRegistry", entry.packageSource.feedName));

        if (entry.packageSource.feedName in ent){
            throw new Error(tl.loc("Error_DuplicateEntryForFeed",
                    entry.packageSource.feedName));
        }
        header += util.format("%s ", entry.packageSource.feedName);
        ent[entry.packageSource.feedName] = new Repository(entry.packageSource.feedUri, entry.username, entry.password);
    }
    let encodedStr = ini.encode(ent);

    header = header + os.EOL + encodedStr;
    return header;
}

main();
