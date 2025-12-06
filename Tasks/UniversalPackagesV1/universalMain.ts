import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import * as universalDownload from "./universalDownload";
import * as universalPublish from "./universalPublish";
import * as helpers from "./universalPackageHelpers";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    let artifactToolPath: string;
    
    try {
        const serverType = tl.getVariable("System.ServerType");
        if (!serverType || serverType.toLowerCase() !== "hosted") {
            throw new Error(tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        }
    } catch (error) {
        helpers.handleTaskError(error, tl.loc("Error_UniversalPackagesNotSupportedOnPrem"));
        return;
    }

    // Get command early so we can use it for proper error handling
    const universalPackageCommand = tl.getInput("command", true);
    const operationType = universalPackageCommand as helpers.OperationType;

    // Verify authentication first before downloading tool
    tl.debug(tl.loc('Debug_SettingUpAuth'));
    const adoServiceConnection = tl.getInput("adoServiceConnection", false);
    let authInfo: helpers.AuthenticationInfo;
    try {
        authInfo = await helpers.setupAuthentication(adoServiceConnection);
    } catch (error) {
        helpers.handleTaskError(error, tl.loc('Error_AuthenticationFailed'));
        return;
    }

    // Download artifact tool after authentication is verified
    tl.debug(tl.loc('Debug_GettingArtifactTool'));
    try {
        artifactToolPath = await helpers.downloadArtifactTool();
    } catch (error) {
        const errorMessage = tl.loc("Error_FailedToGetArtifactTool", error.message);
        helpers.handleTaskError(error, errorMessage);
        return;
    } finally {
        helpers.logUniversalStartupTelemetry(artifactToolPath);
    }

    // Calling the command. download/publish
    switch (operationType) {
        case helpers.OperationType.Download:
            await universalDownload.run(artifactToolPath, authInfo);
            break;
        case helpers.OperationType.Publish:
            await universalPublish.run(artifactToolPath, authInfo);
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", universalPackageCommand));
            return;
    }
}

main();
