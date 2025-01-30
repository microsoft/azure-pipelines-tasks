import * as os from 'os';
import * as fs from 'fs';
import * as tl from "azure-pipelines-task-lib/task";

const minUnsupportedUbuntuVer = 24.04;

export function detectUnsupportedUbuntuVersion(): boolean {
    const platform = os.platform();
    if (platform === 'linux') {
        const lsbContents = _readLinuxVersionFile();
        const { distribution, version } = _parseLinuxVersionInfo(lsbContents);

        if (distribution === 'Ubuntu') {
            const versionFloat = parseFloat(version);
            if (versionFloat >= minUnsupportedUbuntuVer) {
                try {
                    tl.which('mono', true);
                }
                catch (error) {
                    if (error.message === tl.loc("LIB_WhichNotFound_Linux", 'mono')) {
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
    let contents = '';

    if (fs.existsSync(lsbReleaseFile)) {
        contents = fs.readFileSync(lsbReleaseFile).toString();
    } else if (fs.existsSync(osReleaseFile)) {
        contents = fs.readFileSync(osReleaseFile).toString();
    }

    return contents;
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
