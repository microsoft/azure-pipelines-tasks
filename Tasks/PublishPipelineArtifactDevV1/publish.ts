import * as path from "node:path";
import { taskMain, taskRuntime, createArtifactService, publishArtifacts } from "pipeline-artifact-dev-common";

void taskMain(path.join(__dirname, "task.json"), async (tool, serviceUrl, token, signal) => {
    await publishArtifacts(taskRuntime, createArtifactService(serviceUrl, token), tool, signal);
});
