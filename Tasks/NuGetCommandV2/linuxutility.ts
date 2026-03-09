import * as os from 'os';
import * as fs from 'fs';
import * as tl from "azure-pipelines-task-lib/task";

export function detectUnsupportedUbuntuVersion(): boolean {
    const platform = os.platform();
    if (platform === 'linux') {
        const lsbContents = _readLinuxVersionFile();
        if (lsbContents === undefined) { return false; }

        const { distribution, version } = _parseLinuxVersionInfo(lsbContents);

        if (distribution === 'Ubuntu') {
            const versionFloat = parseFloat(version);
            if (versionFloat >= 24.04) {
                try {
                    tl.which('mono', true);
                }
                catch (error) {
                    // Check if mono is not found - handle both the localized message and any which-not-found error
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (errorMessage.includes('mono') || errorMessage === tl.loc("LIB_WhichNotFound_Linux", 'mono')) {
                        return true;
                    }
                    throw error;
                }
            }
        }
    }
    return false
}

function _readLinuxVersionFile(): string {
    const lsbReleaseFile = '/etc/lsb-release';
    const osReleaseFile = '/etc/os-release';

    if (fs.existsSync(lsbReleaseFile)) {
        return fs.readFileSync(lsbReleaseFile).toString();
    } else if (fs.existsSync(osReleaseFile)) {
        return fs.readFileSync(osReleaseFile).toString();
    }

    return undefined;
}

function _parseLinuxVersionInfo(lsbContents): { distribution: string, version: string } {
    const lines = lsbContents.split('\n');
    let distribution = '';
    let version = '';

    for (const line of lines) {
        const parts = line.split('=');
        if (parts.length === 2) {
            const key = parts[0].trim();
            const value = parts[1].trim().replace(/^"/, '').replace(/"$/, '');

            if (key === 'DISTRIB_ID' || key === 'DISTRIB_DESCRIPTION') {
                distribution = value.split(/\s+/)[0];
            } else if (key === 'VERSION_ID' || key === 'DISTRIB_RELEASE') {
                version = value;
            }
        }
    }

    return { distribution, version };
}
