// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { IssueSource } from 'azure-pipelines-task-lib/internal';
import { deleteJobInitScript } from './gradleTaskResources';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

/**
 * Removes only this job's init script, if post-job execution is available.
 * The agent cleans staging beneath Agent.TempDirectory.
 */
function postExecution(): void {
    try {
        if (deleteJobInitScript()) {
            tl.debug(tl.loc('Info_PostExecDeletedInitScript'));
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        tl.warning(tl.loc('Warning_PostExecCleanupFailed', message), IssueSource.TaskInternal);
    } finally {
        tl.setVariable('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO', '');
        tl.setVariable('ARTIFACTS_GRADLE_AUTH_CONFIG', '');
        console.log(tl.loc('Info_PostExecUnsetVars'));
    }
}

postExecution();
