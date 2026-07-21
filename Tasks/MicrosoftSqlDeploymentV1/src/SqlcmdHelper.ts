import * as tl from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import * as fs from 'fs';

const SQLCMD_VERSION = '1.6.0';

export default class SqlcmdHelper {
    /**
     * Discovers sqlcmd executable path.
     * Discovery order:
     * 1. User-provided sqlcmdPath input (validated)
     * 2. Check PATH for sqlcmd
     * 3. Auto-install go-sqlcmd 1.6.0 from GitHub releases (Windows, Linux, macOS)
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
        tl.debug(tl.loc('SqlCmdInstalling'));
        
        try {
            const sqlcmdPath = await this.autoInstallSqlcmd();
            tl.debug(tl.loc('SqlCmdInstalled', sqlcmdPath));
            return sqlcmdPath;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            tl.debug(`Auto-install failed: ${message}`);
            throw new Error(tl.loc('SqlcmdAutoInstallFailed', message));
        }
    }

    /**
     * Downloads and installs go-sqlcmd from GitHub releases.
     * @returns Full path to the sqlcmd executable
     */
    private static async autoInstallSqlcmd(): Promise<string> {
        const platform = process.platform;
        
        if (platform !== 'linux' && platform !== 'win32' && platform !== 'darwin') {
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

        // Make executable on Linux/macOS
        if (platform === 'linux' || platform === 'darwin') {
            fs.chmodSync(sqlcmdPath, '755');
        }

        return sqlcmdPath;
    }

    /**
     * Gets the GitHub release download URL for go-sqlcmd based on platform.
     * @param platform Process platform ('win32', 'linux', or 'darwin')
     * @returns Download URL for the appropriate platform archive
     */
    private static getDownloadUrl(platform: string): string {
        const baseUrl = `https://github.com/microsoft/go-sqlcmd/releases/download/v${SQLCMD_VERSION}`;
        const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

        // 'win32' is Node.js's platform identifier for all Windows (32-bit and 64-bit)
        if (platform === 'win32') {
            return `${baseUrl}/sqlcmd-v${SQLCMD_VERSION}-windows-${arch}.zip`;
        } else if (platform === 'darwin') {
            return `${baseUrl}/sqlcmd-v${SQLCMD_VERSION}-darwin-${arch}.tar.bz2`;
        } else {
            return `${baseUrl}/sqlcmd-v${SQLCMD_VERSION}-linux-${arch}.tar.bz2`;
        }
    }
}
