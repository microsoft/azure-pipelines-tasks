import * as tl from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import * as fs from 'fs';

const SQLCMD_TOOL_NAME = 'go-sqlcmd';
const SQLCMD_VERSION = '1.6.0';

export default class SqlcmdHelper {
    /**
     * Discovers sqlcmd executable path.
     * Discovery order:
     * 1. User-provided sqlcmdPath input (validated)
     * 2. Check PATH for sqlcmd
     * 3. Auto-install go-sqlcmd 1.6.0 from GitHub releases
     * 
     * @param sqlcmdPathInput Optional user-provided path to sqlcmd executable
     * @returns Full path to sqlcmd executable
     * @throws Error if sqlcmd cannot be found or installed
     */
    public static async findSqlcmd(sqlcmdPathInput?: string): Promise<string> {
        tl.debug('Starting sqlcmd discovery...');

        // 1. Check user-provided input
        if (sqlcmdPathInput) {
            tl.debug(`Checking user-provided sqlcmdPath: ${sqlcmdPathInput}`);
            if (fs.existsSync(sqlcmdPathInput)) {
                tl.debug(`Found sqlcmd at user-provided path: ${sqlcmdPathInput}`);
                return sqlcmdPathInput;
            }
            throw new Error(tl.loc('SqlcmdNotFoundAtPath', sqlcmdPathInput));
        }

        // 2. Check PATH
        const sqlcmdInPath = tl.which('sqlcmd', false);
        if (sqlcmdInPath) {
            tl.debug(`Found sqlcmd on PATH: ${sqlcmdInPath}`);
            return sqlcmdInPath;
        }

        // 3. Auto-install go-sqlcmd
        tl.debug('sqlcmd not found on PATH. Attempting to auto-install go-sqlcmd...');
        
        try {
            const sqlcmdPath = await this.autoInstallSqlcmd();
            tl.debug(`Auto-installed go-sqlcmd at: ${sqlcmdPath}`);
            return sqlcmdPath;
        } catch (error) {
            tl.debug(`Auto-install failed: ${error.message}`);
            throw new Error(tl.loc('SqlcmdAutoInstallFailed', error.message));
        }
    }

    /**
     * Downloads and installs go-sqlcmd from GitHub releases.
     * @returns Full path to the sqlcmd executable
     */
    private static async autoInstallSqlcmd(): Promise<string> {
        const platform = process.platform;
        
        if (platform !== 'linux' && platform !== 'win32') {
            throw new Error(tl.loc('SqlcmdUnsupportedPlatform', platform));
        }

        const downloadUrl = this.getDownloadUrl(platform);
        const executableName = platform === 'win32' ? 'sqlcmd.exe' : 'sqlcmd';

        tl.debug(`Downloading go-sqlcmd from: ${downloadUrl}`);
        
        // Download the archive
        const downloadPath = await tool.downloadTool(downloadUrl);
        tl.debug(`Downloaded to: ${downloadPath}`);

        // Extract the archive
        let extractedPath: string;
        if (platform === 'win32') {
            extractedPath = await tool.extractZip(downloadPath);
        } else {
            // Linux: tar.bz2 file - azure-pipelines-tool-lib auto-detects compression
            extractedPath = await tool.extractTar(downloadPath);
        }
        tl.debug(`Extracted to: ${extractedPath}`);

        // Find the sqlcmd executable in the extracted directory
        const sqlcmdPath = path.join(extractedPath, executableName);
        
        if (!fs.existsSync(sqlcmdPath)) {
            throw new Error(tl.loc('SqlcmdExecutableNotFoundAfterExtract', sqlcmdPath));
        }

        // Make executable on Linux
        if (platform === 'linux') {
            fs.chmodSync(sqlcmdPath, '755');
        }

        return sqlcmdPath;
    }

    /**
     * Gets the GitHub release download URL for go-sqlcmd based on platform.
     * @param platform Process platform ('linux' or 'win32')
     * @returns Download URL for the appropriate platform archive
     */
    private static getDownloadUrl(platform: string): string {
        const baseUrl = `https://github.com/microsoft/go-sqlcmd/releases/download/v${SQLCMD_VERSION}`;
        
        if (platform === 'win32') {
            return `${baseUrl}/sqlcmd-v${SQLCMD_VERSION}-windows-x64.zip`;
        } else {
            return `${baseUrl}/sqlcmd-v${SQLCMD_VERSION}-linux-x64.tar.bz2`;
        }
    }
}
