import tl = require("azure-pipelines-task-lib/task");

import { TaskRunner } from './task-runner';

let runAsPreJob: boolean = tl.getBoolInput('RunAsPreJob', true);
if (runAsPreJob) {
    TaskRunner.run();
} else {
    tl.setResult(tl.TaskResult.Skipped, "Skipped as long as this task is not configured to be executed as a pre-job.");
}