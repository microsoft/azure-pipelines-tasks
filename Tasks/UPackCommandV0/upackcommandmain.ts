import * as path from "path";
import * as telemetry from "utility-common/telemetry";
import * as tl from "vsts-task-lib/task";
import * as artifactToolUtilities from "./Common/ArtifactToolUtilities";
import * as auth from "./Common/Authentication";
import * as upackDownload from "./upackdownload";
import * as upackPublish from "./upackpublish";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Getting artifact tool
    tl.debug("Getting artifact tool");
    let artifactToolPath: string;

    try {
        const localAccessToken = auth.getSystemAccessToken();
        const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        const blobUri = await artifactToolUtilities.getBlobstoreUriFromBaseServiceUri(
            serviceUri,
            localAccessToken);

        // Finding the artifact tool directory
        artifactToolPath = await artifactToolUtilities.getArtifactToolFromService(
            blobUri,
            localAccessToken,
            "artifacttool");
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
        return;
    } finally{
        _logUPackStartupVariables(artifactToolPath);
    }

    // Calling the command. download/publish
    const upackCommand = tl.getInput("command", true);
    switch (upackCommand) {
        case "download":
            upackDownload.run(artifactToolPath);
            break;
        case "publish":
            upackPublish.run(artifactToolPath);
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", upackCommand));
            break;
    }
}

function _logUPackStartupVariables(artifactToolPath: string) {
    try {
        let upackTelemetry = {
            "command": tl.getInput("command"),
            "buildProperties": tl.getInput("buildProperties"),
            "basePath": tl.getInput("basePath"),
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "verbosity": tl.getInput("verbosity"),
            "solution": tl.getInput("solution"),
            "artifactToolPath": artifactToolPath,
            };

        telemetry.emitTelemetry("Packaging", "UniversalPackages", upackTelemetry);
    } catch (err) {
        tl.debug(`Unable to log universal packages task init telemetry. Err:( ${err} )`);
    }
}

main();
