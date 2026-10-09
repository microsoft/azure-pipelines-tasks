import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

/**
 * AZURE_CONFIG_DIR isolation helper for the AzureCLI@1/@2/@3 tasks.
 *
 * NOTE: this file is intentionally duplicated under
 * Tasks/AzureCLIV1/src, Tasks/AzureCLIV2/src and Tasks/AzureCLIV3/src.
 * Each AzureCLI task is shipped as a self-contained npm package and the
 * repo convention is to keep small, task-coupled helpers in the task
 * folder rather than introduce a new shared package. Keep all three
 * copies in sync when changing this file.
 *
 * Background: the legacy code pointed AZURE_CONFIG_DIR at the predictable
 * path $(Agent.TempDirectory)/.azclitask which allowed any earlier
 * pipeline step running on the same agent to pre-seed a poisoned `config`
 * file (e.g. extension.index_url / use_dynamic_install /
 * run_after_dynamic_install) and achieve code execution under the
 * service-connection identity once the AzureCLI task subsequently invoked
 * `az`. Creating a fresh, unpredictable directory per invocation closes
 * that gap.
 */

/**
 * Creates a per-invocation, unpredictable AZURE_CONFIG_DIR under the
 * supplied agent temp directory and points process.env.AZURE_CONFIG_DIR
 * at it. Returns the absolute path. The directory has the form
 * `${agentTempDir}/.azclitask-XXXXXX` where XXXXXX is six
 * cryptographically-random alphanumeric characters chosen by libuv
 * (filesystem-safe on every supported OS). Pairing the env-var set with
 * the directory creation here (and the unset with cleanup in
 * removePerInvocationAzureConfigDir) keeps the lifetime of the variable
 * scoped to the lifetime of the directory.
 */
export function createPerInvocationAzureConfigDir(agentTempDir: string): string {
    if (!agentTempDir) {
        throw new Error('agentTempDir is required');
    }
    let dir: string;
    try {
        dir = fs.mkdtempSync(path.join(agentTempDir, '.azclitask-'));
    } catch (mkErr) {
        // Fail loudly. We deliberately do NOT fall back to the predictable
        // $(Agent.TempDirectory)/.azclitask path (that is the very vulnerability
        // this code closes) nor silently to the user's global ~/.azure profile
        // (that would override the user's explicit useGlobalConfig=false choice
        // and could mutate the agent identity's profile across pipeline runs).
        // The caller's outer catch surfaces this as a task failure.
        const msg = (mkErr && (mkErr as Error).message) || String(mkErr);
        throw new Error(
            `Failed to create an isolated AZURE_CONFIG_DIR under '${agentTempDir}': ${msg}. ` +
            `Verify Agent.TempDirectory exists and is writable by the agent account. ` +
            `If you intentionally want to use the global Azure CLI configuration (~/.azure), ` +
            `set the task input 'useGlobalConfig: true'.`);
    }
    process.env['AZURE_CONFIG_DIR'] = dir;
    return dir;
}

/**
 * Removes a directory previously created by
 * createPerInvocationAzureConfigDir and unsets the AZURE_CONFIG_DIR env
 * var. Safe to call in `finally` — never throws; logs to tl.debug on
 * failure so a broken cleanup cannot mask the original task error.
 */
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