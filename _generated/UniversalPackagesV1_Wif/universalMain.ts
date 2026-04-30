import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import * as universalDownload from "./universalDownload";
import * as universalPublish from "./universalPublish";
import { UniversalPackageContext, OperationType } from "./UniversalPackageContext";
import * as helpers from "./universalPackageHelpers";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Validate server type
    if (!(await helpers.validateServerType())) return;

    // Create context and get inputs
    const context = new UniversalPackageContext();

    // Validate version inputs
    if (!helpers.validateVersionInputs(context)) return;

    // Set up authentication
    if (!(await helpers.trySetAuth(context))) return;

    // Parse feed input
    helpers.setFeed(context);

    // The pre-execution step should have downloaded artifacttool and set the path
    const artifactToolPath = tl.getTaskVariable("UPACK_ARTIFACTTOOL_PATH");
    if (!artifactToolPath) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("Error_FailedToGetArtifactTool", tl.loc("Error_ArtifactToolPathNotSet")));
        return;
    }
    context.artifactToolPath = artifactToolPath;
    helpers.logArtifactToolTelemetry(context);

    // Calling the command. download/publish
    switch (context.command) {
        case OperationType.Download:
            await universalDownload.run(context);
            break;
        case OperationType.Publish:
            await universalPublish.run(context);
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", context.command));
            return;
    }
}

main();
