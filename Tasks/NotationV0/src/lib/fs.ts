import * as os from 'os';
import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';

export function getConfigHome(): string {
    const platform = os.platform();
    switch (platform) {
        case 'win32':
            if (!process.env.APPDATA) {
                throw new Error(taskLib.loc('APPDATANotSet'));
            }
            return process.env.APPDATA;
        case 'darwin':
            return path.join(os.homedir(), 'Library', 'Application Support');
        case 'linux':
            return process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : path.join(os.homedir(), '.config');
        default:
            throw new Error(`Unknown platform: ${platform}`);
    }
}
