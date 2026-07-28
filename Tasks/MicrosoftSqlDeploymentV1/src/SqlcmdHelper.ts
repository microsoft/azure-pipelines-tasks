import * as tl from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import * as fs from 'fs';

const SQLCMD_VERSION = '1.6.0';

export default class SqlcmdHelper {
    /**
     * Discovers go-sqlcmd executable path.
     *
     * This task targets go-sqlcmd (github.com/microsoft/go-sqlcmd) exclusively.
     * ODBC sqlcmd (mssql-tools) is NOT supported — its auth flags differ
     * (no --authentication-method; AAD SP auth is unsupported).
     *
     * Discovery order:
     * 1. User-provided sqlcmdPath input (accepted as-is, user's responsibility)
     * 2. PATH — verified to be go-sqlcmd via --version; falls through to auto-install if ODBC
     * 3. Auto-install go-sqlcmd 1.6.0 from GitHub releases
     */
    public static async findSqlcmd(sqlcmdPathInput?: string): Promise<string> {
        tl.debug('Starting sqlcmd discovery...');

        // 1. User-provided path — accepted without variant check
        if (sqlcmdPathInput) {
            tl.debug(`Checking user-provided sqlcmdPath: ${sqlcmdPathInput}`);
            if (fs.existsSync(sqlcmdPathInput)) {
                tl.debug(`Found sqlcmd at user-provided path: ${sqlcmdPathInput}`);
                return sqlcmdPathInput;
            }
            throw new Error(tl.loc('SqlcmdNotFoundAtPath', sqlcmdPathInput));
        }

        // 2. PATH — only use if the binary is go-sqlcmd, not ODBC sqlcmd (mssql-tools)
        const sqlcmdInPath = tl.which('sqlcmd', false);
        if (sqlcmdInPath && await this.isGoSqlcmd(sqlcmdInPath)) {
            tl.debug(`Found go-sqlcmd on PATH: ${sqlcmdInPath}`);
            return sqlcmdInPath;
        }
        if (sqlcmdInPath) {
            tl.debug('sqlcmd on PATH is ODBC sqlcmd (mssql-tools), not go-sqlcmd — auto-installing go-sqlcmd');
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
     * Returns true if the binary at the given path is go-sqlcmd.
     *
     * Detection algorithm (two-step):
     * 1. Run --version. If output contains "sqlcmd version" → go-sqlcmd.
     * 2. If still ambiguous, run -? (help).
     *    "Microsoft (R) SQL Server Command Line Tool" → ODBC sqlcmd.
     *    "Version:" in output → go-sqlcmd (shown in -? banner).
     */
    private static async isGoSqlcmd(sqlcmdPath: string): Promise<boolean> {
        const runAndCapture = async (args: string[]): Promise<string> => {
            let output = '';
            await tl.exec(sqlcmdPath, args, {
                failOnStdErr: false,
                ignoreReturnCode: true,
                outStream: new (require('stream').Writable)({
                    write(chunk: Buffer, _enc: string, cb: () => void) { output += chunk.toString(); cb(); }
                }) as NodeJS.WritableStream,
                errStream: new (require('stream').Writable)({
                    write(chunk: Buffer, _enc: string, cb: () => void) { output += chunk.toString(); cb(); }
                }) as NodeJS.WritableStream
            });
            return output;
        };

        try {
            // Step 1: --version
            // go-sqlcmd prints banner like "sqlcmd - the Microsoft SQL Server command line utility (go-sqlcmd)"
            // followed by "Version: X.X.X". ODBC sqlcmd does not support --version.
            const versionOutput = await runAndCapture(['--version']);
            tl.debug(`sqlcmd --version: ${versionOutput.trim().split('\n')[0]}`);
            if (/sqlcmd version /i.test(versionOutput) || /Version:\s*\d/i.test(versionOutput)) {
                return true;
            }

            // Step 2: -? (help)
            // ODBC sqlcmd always starts with "Microsoft (R) SQL Server Command Line Tool".
            // go-sqlcmd does not print that header.
            const helpOutput = await runAndCapture(['-?']);
            tl.debug(`sqlcmd -?: ${helpOutput.trim().split('\n')[0]}`);
            if (/Microsoft \(R\) SQL Server Command Line Tool/i.test(helpOutput)) {
                return false; // ODBC sqlcmd
            }
            // go-sqlcmd-specific help text — none of these appear in ODBC sqlcmd
            if (
                /--authentication-method/i.test(helpOutput) ||
                /driver-logging-level/i.test(helpOutput) ||
                /Available Commands:/i.test(helpOutput)
            ) {
                return true; // go-sqlcmd
            }

            tl.debug('Could not determine sqlcmd variant — assuming not go-sqlcmd');
            return false;
        } catch {
            tl.debug('Could not determine sqlcmd variant via --version/-? — assuming not go-sqlcmd');
            return false;
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
