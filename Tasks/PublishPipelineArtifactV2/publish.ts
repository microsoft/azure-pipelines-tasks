import * as fs from "fs";
import { preparePublish, runTask } from "pipeline-artifact-common";

void runTask(async context => preparePublish(context.task, {
    exists: file => fs.existsSync(file),
    log: context.log
}));