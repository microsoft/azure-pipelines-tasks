import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

/**
 * AZURE_CONFIG_DIR isolation helper for the BicepDeploy@0 task.
 *
 * NOTE: this file is a task-local copy of
 * Tasks/AzureCLIV3/src/AzureCliConfigDir.ts (which is itself intentionally
 * duplicated across Tasks/AzureCLIV{1,2,3}/src). The repo convention is to
 * keep small, task-coupled helpers in the task folder rather than introduce
 * a shared package, so BicepDeployV0 owns its own copy. Keep this file in
 * sync with the AzureCLIV3 source when behavior changes there.
 *
 * Background: when several agents share a host, a shared AZURE_CONFIG_DIR
 * lets one task's `az account clear` at exit invalidate a credential another
 * task is mid-way through using, surfacing as `ChainedTokenCredential
 * authentication failed.`. Creating a fresh, unpredictable directory per
 * invocation isolates each run's Azure CLI state and eliminates the race.
 *
 * The two helpers are a pair: each sets or unsets process.env.AZURE_CONFIG_DIR
 * alongside the directory so the variable's lifetime matches the directory's.
 * Removal is safe in `finally` — it never throws, so a failed cleanup cannot
 * mask the original task error.
 */
export function createPerInvocationAzureConfigDir(agentTempDir: string): string {
    if (!agentTempDir) {
        throw new Error('agentTempDir is required');
    }
    let dir: string;
    try {
        dir = fs.mkdtempSync(path.join(agentTempDir, '.bicepdeploy-'));
    } catch (mkErr) {
        // Fail loudly rather than falling back to a predictable path or the
        // global ~/.azure profile — both reintroduce the race this closes.
        const msg = (mkErr && (mkErr as Error).message) || String(mkErr);
        throw new Error(
            `Failed to create an isolated AZURE_CONFIG_DIR under '${agentTempDir}': ${msg}. ` +
            `Verify Agent.TempDirectory exists and is writable by the agent account.`);
    }
    process.env['AZURE_CONFIG_DIR'] = dir;
    return dir;
}

export function removePerInvocationAzureConfigDir(configPath: string | null | undefined): void {
    if (!configPath) {
        return;
    }
    tl.debug(`Removing per-invocation AZURE_CONFIG_DIR: ${configPath}`);
    try {
        tl.rmRF(configPath);
    } catch (rmErr) {
        const msg = (rmErr && (rmErr as Error).message) || String(rmErr);
        tl.debug(`Failed to remove AZURE_CONFIG_DIR: ${msg}`);
    }
    try {
        delete process.env['AZURE_CONFIG_DIR'];
    } catch { /* ignore */ }
}
