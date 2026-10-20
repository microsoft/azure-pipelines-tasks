import { prepareDownload, runTask } from "pipeline-artifact-common";

void runTask(context => prepareDownload(context.task, context.buildService(), context.log));