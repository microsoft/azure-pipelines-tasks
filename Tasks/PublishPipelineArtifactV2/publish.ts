import * as fs from "fs";
import { preparePublish, runTask } from "pipeline-artifact-common";

void runTask(async context => preparePublish(context.task, { platform: process.platform, exists: file => fs.existsSync(file) }));