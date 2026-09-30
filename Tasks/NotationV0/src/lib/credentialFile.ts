import * as taskLib from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';

export interface CredentialFile {
    filePath: string;
    directoryPath: string;
}

// Writes a credential into a new, uniquely named, owner-only directory so that its path is not
// predictable and it can be removed as soon as the Notation operation completes.
export function writeCredentialFile(tempDirectory: string, fileName: string, content: string): CredentialFile {
    const directoryPath = fs.mkdtempSync(path.join(tempDirectory, '.notation-credentials-'));
    const filePath = path.join(directoryPath, fileName);
    try {
        if (process.platform !== 'win32') {
            fs.chmodSync(directoryPath, 0o700);
        }
        fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        return { filePath, directoryPath };
    } catch (error) {
        removeCredentialFile({ filePath, directoryPath });
        throw error;
    }
}

export function removeCredentialFile(credentialFile: CredentialFile | undefined): void {
    if (!credentialFile) {
        return;
    }

    try {
        fs.rmSync(credentialFile.directoryPath, { recursive: true, force: true });
    } catch {
        // A cleanup failure must not hide the signing result.
        taskLib.warning(taskLib.loc('FailedToRemoveCredentialFile'));
    }
}
