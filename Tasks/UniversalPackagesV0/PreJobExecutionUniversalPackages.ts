import tl = require('azure-pipelines-task-lib/task');
import * as path from "path";
import { getArtifactToolPath } from './artifacttoolresolver';
import { logUniversalStartupVariables } from './universaltelemetry';

async function run(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    let artifactToolPath: string = "";
    try {
        artifactToolPath = await getArtifactToolPath();
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToGetArtifactTool", error.message));
        return;
    } finally {
        logUniversalStartupVariables(artifactToolPath);
    }
}

run();