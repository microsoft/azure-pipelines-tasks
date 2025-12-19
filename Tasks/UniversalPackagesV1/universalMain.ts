import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import * as universalDownload from "./universalDownload";
import * as universalPublish from "./universalPublish";
import { UniversalPackageContext, OperationType } from "./UniversalPackageContext";
import * as helpers from "./universalPackageHelpers";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Validate server type
    if (!helpers.validateServerType()) return;

    // Create context and get inputs
    const context = new UniversalPackageContext();

    // Set up authentication
    if (!(await helpers.trySetAuth(context))) return;

    // Validate feed and organization
    if (!(await helpers.trySetFeed(context))) return;

    // Download artifact tool
    if (!(await helpers.tryDownloadArtifactTool(context))) return;

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
