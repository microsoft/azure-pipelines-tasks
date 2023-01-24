import * as path from 'path';
import * as os from 'os';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';

const osPlatform: string = os.platform();

/**
 * Extracts archive
 * @param archivePath Path to archive
 * @returns Extracted archive path
 */
export async function extractArchive(archivePath: string): Promise<string> {

    if (osPlatform === 'win32') {
        const agentTempDir = taskLib.getVariable('Agent.TempDirectory');
        if (!agentTempDir) {
            throw new Error(taskLib.loc('AgentTempDirNotSet'));
        }

        const pathTo7z = path.resolve(__dirname, '..', '7zr.exe');

        return await toolLib.extract7z(archivePath, agentTempDir, pathTo7z);
    } else {
        return await toolLib.extractTar(archivePath);
    }
}
