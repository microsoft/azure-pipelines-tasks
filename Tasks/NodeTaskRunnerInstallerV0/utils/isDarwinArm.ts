import * as taskLib from 'azure-pipelines-task-lib/task';

/**
 * Check is the system are darwin arm and rosetta is installed
*/
export function isDarwinArm(osPlat: string, installedArch: string): boolean {
    if (osPlat === 'darwin' && installedArch === 'arm64') {

        // Check that Rosetta is installed and returns some pid
        const execResult = taskLib.execSync('pgrep', 'oahd');

        return execResult.code === 0 && !!execResult.stdout;
    }

    return false;
}
