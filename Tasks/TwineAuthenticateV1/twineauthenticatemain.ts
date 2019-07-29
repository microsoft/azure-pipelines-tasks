import * as fs from "fs";
import * as ini from "ini";
import * as os from "os";
import * as path from "path";
import * as util from "util";
import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "utility-common/telemetry";
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
    try {
        // Local feeds
        const internalFeed = await auth.getInternalAuthInfoArray("artifactFeed");
        // external service endpoints
        const externalEndpoints = await auth.getExternalAuthInfoArray("pythonUploadServiceConnection");
        // combination of both internal and external
        const newEndpointsToAdd = internalFeed.concat(externalEndpoints);

        let pypircPath = utils.getPypircPath();

        // create new file. We do not merge existing files and always create a fresh file
        fs.writeFileSync(pypircPath, formPypircFormatFromData(newEndpointsToAdd));
        tl.setVariable("PYPIRC_PATH", pypircPath, false);
        tl.debug(tl.loc("VariableSetForPypirc", pypircPath));

        // Configuring the pypirc file
        console.log(tl.loc("Info_SuccessAddingAuth", internalFeed.length, externalEndpoints.length));
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    } finally{
        _logTwineAuthStartupVariables();
    }
}
 // Telemetry
function _logTwineAuthStartupVariables() {
    try {
        const twineAuthenticateTelemetry = {
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            };
        telemetry.emitTelemetry("Packaging", "TwineAuthenticate", twineAuthenticateTelemetry);
    } catch (err) {
        tl.debug(`Unable to log Twine Authenticate task init telemetry. Err:( ${err} )`);
    }
}

// only used for new file writes.
function formPypircFormatFromData(authInfo: auth.AuthInfo[]): string{
    let ent : {} = {};

    let header = util.format("[distutils]%sindex-servers=", os.EOL);

    for(let entry of authInfo) {
        console.log(tl.loc("Info_AddingAuthForRegistry", entry.packageSource.feedName));

        if (entry.packageSource.feedName in ent){
            throw new Error(tl.loc("Error_DuplicateEntryForExternalFeed",
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
