import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import * as universalDownload from "./universaldownload";
import * as universalPublish from "./universalpublish";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));
    
    // The preexecution step should have downloaded artifacttool and set the path
    const artifactToolPath = tl.getTaskVariable("UPACK_ARTIFACTTOOL_PATH");
    if (!artifactToolPath) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToGetArtifactTool", tl.loc("Error_ArtifactToolPathNotSet")));
        return;
    }
    
    // Calling the command. download/publish
    const universalPackageCommand = tl.getInput("command", true);
    switch (universalPackageCommand) {
        case "download":
            universalDownload.run(artifactToolPath);
            break;
        case "publish":
            universalPublish.run(artifactToolPath);
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", universalPackageCommand));
            break;
    }
}

main();
