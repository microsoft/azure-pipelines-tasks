import * as os from 'os';
import * as fs from 'fs';
import * as tl from "azure-pipelines-task-lib/task";

export function detectUbuntu24(): boolean {
    const platform = os.platform();
    if (platform === 'linux') {
        const lbsContents = _readLinuxVersionFile();
        const distribution = _parseLinuxDistribution(lbsContents);
        if (distribution === 'Ubuntu') {
            const version = parseFloat(_parseUbuntuVersion(lbsContents));
            if (version >= 24) {
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

function _parseLinuxDistribution(lbsContents): string {
    const lines = lbsContents.split('\n');
    for (const line of lines) {
        const parts = line.split('=');
        if (
            parts.length === 2 &&
            (parts[0].trim() === 'DISTRIB_ID' ||
                parts[0].trim() === 'DISTRIB_DESCRIPTION')
        ) {
            return parts[1]
                .trim()
                .split(/\s+/)[0]
                .replace(/^"/, '')
                .replace(/"$/, '');
        }
    }
    return '';
}

function _parseUbuntuVersion(lbsContents): string {
    const lines = lbsContents.split('\n');
    for (const line of lines) {
        const parts = line.split('=');
        if (
            parts.length === 2 &&
            (parts[0].trim() === 'VERSION_ID' ||
                parts[0].trim() === 'DISTRIB_RELEASE')
        ) {
            return parts[1]
                .trim()
                .replace(/^"/, '')
                .replace(/"$/, '');
        }
    }
    return '';
}