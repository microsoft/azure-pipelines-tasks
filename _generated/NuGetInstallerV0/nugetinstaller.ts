import * as tl from "azure-pipelines-task-lib/task";

async function main(): Promise<void> {
    tl.setResult(tl.TaskResult.Failed, tl.loc("DeprecatedTask"));
}

main();
