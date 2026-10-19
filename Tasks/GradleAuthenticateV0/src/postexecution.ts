// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { IssueSource } from 'azure-pipelines-task-lib/internal';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

/**
 * Post-step cleanup — guaranteed to run after the Gradle build step completes.
 *
 * Deletes:
 * 1. The init script from ~/.gradle/init.d/
 * 2. The temp directory (CI JAR layout + auth config JSON)
 *
 * Unsets:
 * - ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO
 * - ARTIFACTS_GRADLE_AUTH_CONFIG
 */
function postExecution(): void {
    try {
        // Delete init script
        const initScriptPath = tl.getTaskVariable('ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_PATH');
        if (initScriptPath && fs.existsSync(initScriptPath)) {
            fs.unlinkSync(initScriptPath);
            tl.debug(tl.loc('Info_PostExecDeletedInitScript'));
        }

        // Delete temp directory (CI JAR layout + auth config)
        const tempDir = tl.getTaskVariable('ARTIFACTS_GRADLE_AUTH_TEMP_DIR');
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            tl.debug(tl.loc('Info_PostExecDeletedTempDir'));
        }

        // Unset environment variables
        tl.setVariable('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO', '');
        tl.setVariable('ARTIFACTS_GRADLE_AUTH_CONFIG', '');
        console.log(tl.loc('Info_PostExecUnsetVars'));

    } catch {
        tl.warning(tl.loc('Warning_PostExecCleanupFailed'), IssueSource.TaskInternal);
    }
}

postExecution();
