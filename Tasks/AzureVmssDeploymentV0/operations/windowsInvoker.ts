import fs = require('fs');
import os = require('os');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import { randomBytes } from 'crypto';

export const WindowsInvokerPayloadLimit = 1024 * 1024;
export const WindowsInvokerFileName = 'vmssDataInvoker.ps1';
export const WindowsInvokerPayloadFileName = 'vmssScriptArgs.json';
export const WindowsInvokerArchiveFileName = 'scripts.zip';

export interface WindowsInvokerInfo {
    localDirPath: string;
    command: string;
    blobsPrefixPath: string;
}

export function prepareWindowsInvoker(
    scriptsDirectory: string,
    script: string,
    scriptArgs: string,
    archivePath?: string
): WindowsInvokerInfo {
    const normalizedScript = path.win32.normalize(script);
    if (path.win32.isAbsolute(script) || /[:\r\n\0]/.test(script)
        || normalizedScript === '..' || normalizedScript.startsWith('..\\')
        || path.win32.extname(script).toLowerCase() !== '.ps1') {
        throw new Error(tl.loc('InvalidWindowsCustomScript'));
    }
    const payload = JSON.stringify({
        version: 1,
        script,
        scriptArgs: scriptArgs === undefined ? '' : scriptArgs,
        archived: !!archivePath
    });
    if (Buffer.byteLength(payload, 'utf8') > WindowsInvokerPayloadLimit) {
        throw new Error(tl.loc('WindowsScriptPayloadTooLarge'));
    }

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vstsvmss-data-'));
    let prepared = false;
    try {
        if (archivePath) {
            fs.copyFileSync(archivePath, path.join(directory, WindowsInvokerArchiveFileName), fs.constants.COPYFILE_EXCL);
        } else {
            fs.cpSync(scriptsDirectory, path.join(directory, 'scripts'), { recursive: true, errorOnExist: true, force: false });
        }
        fs.copyFileSync(path.join(__dirname, '..', 'Resources', WindowsInvokerFileName),
            path.join(directory, WindowsInvokerFileName), fs.constants.COPYFILE_EXCL);
        fs.writeFileSync(path.join(directory, WindowsInvokerPayloadFileName), payload,
            { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        // Only this generated ASCII identifier, never pipeline values, enters the CMD-facing path.
        const prefix = `vmss-${randomBytes(16).toString('hex')}`;
        const command = `"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -File ".\\${prefix}\\${WindowsInvokerFileName}"`;
        prepared = true;
        return { localDirPath: directory, command, blobsPrefixPath: prefix };
    } finally {
        if (!prepared) {
            fs.rmSync(directory, { recursive: true });
        }
    }
}
