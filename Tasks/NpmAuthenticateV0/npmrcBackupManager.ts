import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

export interface FileIdentity {
    device: string;
    inode: string;
}

export const NpmrcFileIdentityTaskVariable = 'NPM_AUTHENTICATE_FILE_IDENTITY';

// Tracks which .npmrc files have been backed up so that npmauthcleanup can
// restore them. The first snapshot per file is kept; subsequent calls validate
// that the path still resolves to the same regular file.

export class NpmrcBackupManager {
    private readonly indexFilePath: string;
    private nextId: number;
    private entries: { [npmrcPath: string]: number };
    private identities: { [npmrcPath: string]: FileIdentity };

    constructor(private readonly backupDirectory: string) {
        this.indexFilePath = path.join(backupDirectory, 'index.json');
        const data = this.loadOrCreateIndex();
        this.nextId = data.nextId;
        this.entries = data.entries;
        this.identities = data.identities || {};
    }

    ensureBackedUp(npmrcPath: string): FileIdentity {
        if (this.entries[npmrcPath] !== undefined) {
            const currentIdentity = this.getRegularFileIdentity(npmrcPath, 'NpmrcMustBeRegularFile');
            const expectedIdentity = this.identities[npmrcPath];
            if (expectedIdentity && !this.hasIdentity(currentIdentity, expectedIdentity)) {
                throw new Error(tl.loc('NpmrcChangedSinceBackup', npmrcPath));
            }
            if (!expectedIdentity) {
                this.identities[npmrcPath] = currentIdentity;
                this.saveIndex();
            }
            return currentIdentity;
        }
        const entryId = this.nextId;
        const identity = this.saveFileWithName(npmrcPath, entryId);
        this.nextId++;
        this.entries[npmrcPath] = entryId;
        this.identities[npmrcPath] = identity;
        this.saveIndex();
        return identity;
    }

    restoreBackedUpFile(npmrcPath: string, trustedIdentity?: FileIdentity): boolean {
        const entryId = this.entries[npmrcPath];
        if (entryId === undefined) {
            return false;
        }

        const backupPath = this.getBackupFilePath(entryId);
        if (!fs.existsSync(backupPath)) {
            return false;
        }

        const backupHandle = fs.openSync(backupPath, 'r');
        try {
            const destinationStats = fs.lstatSync(npmrcPath, { bigint: true });
            const expectedIdentity = trustedIdentity || this.identities[npmrcPath];
            if (!destinationStats.isFile()
                || (expectedIdentity && !this.hasIdentity(destinationStats, expectedIdentity))) {
                throw new Error(tl.loc('NpmrcChangedSinceBackup', npmrcPath));
            }

            const destinationHandle = fs.openSync(npmrcPath, 'r+');
            try {
                const openedStats = fs.fstatSync(destinationHandle, { bigint: true });
                if (!openedStats.isFile()
                    || !this.hasIdentity(openedStats, this.getIdentity(destinationStats))
                    || (expectedIdentity && !this.hasIdentity(openedStats, expectedIdentity))) {
                    throw new Error(tl.loc('NpmrcChangedSinceBackup', npmrcPath));
                }

                fs.ftruncateSync(destinationHandle, 0);
                this.copyFileContents(backupHandle, destinationHandle);
            } finally {
                fs.closeSync(destinationHandle);
            }
        } finally {
            fs.closeSync(backupHandle);
        }
        fs.unlinkSync(backupPath);
        return true;
    }

    isOnlyIndexFileRemaining(): boolean {
        return fs.readdirSync(this.backupDirectory).length === 1;
    }

    private loadOrCreateIndex(): {
        nextId: number;
        entries: { [npmrcPath: string]: number };
        identities?: { [npmrcPath: string]: FileIdentity };
    } {
        if (fs.existsSync(this.indexFilePath)) {
            return JSON.parse(fs.readFileSync(this.indexFilePath, 'utf8'));
        }
        return { nextId: 0, entries: {}, identities: {} };
    }

    private saveIndex(): void {
        fs.writeFileSync(this.indexFilePath, JSON.stringify({
            nextId: this.nextId,
            entries: this.entries,
            identities: this.identities
        }));
    }

    private getBackupFilePath(entryId: number | string): string {
        return path.join(this.backupDirectory, String(entryId));
    }

    private saveFileWithName(sourcePath: string, entryId: number): FileIdentity {
        const backupPath = this.getBackupFilePath(entryId);
        tl.debug(tl.loc('SavingFile', sourcePath));
        const source = this.openRegularFile(sourcePath, 'NpmrcMustBeRegularFile');

        try {
            const backupHandle = fs.openSync(backupPath, 'w', source.mode);
            try {
                this.copyFileContents(source.handle, backupHandle);
                fs.fchmodSync(backupHandle, source.mode);
            } finally {
                fs.closeSync(backupHandle);
            }
        } finally {
            fs.closeSync(source.handle);
        }
        return source.identity;
    }

    private getRegularFileIdentity(filePath: string, errorMessageKey: string): FileIdentity {
        const file = this.openRegularFile(filePath, errorMessageKey);
        try {
            return file.identity;
        } finally {
            fs.closeSync(file.handle);
        }
    }

    private openRegularFile(filePath: string, errorMessageKey: string): {
        handle: number;
        identity: FileIdentity;
        mode: number;
    } {
        const pathStats = fs.lstatSync(filePath, { bigint: true });
        if (!pathStats.isFile()) {
            throw new Error(tl.loc(errorMessageKey, filePath));
        }

        const fileHandle = fs.openSync(filePath, 'r');
        try {
            const openedStats = fs.fstatSync(fileHandle, { bigint: true });
            if (!openedStats.isFile() || !this.hasIdentity(openedStats, this.getIdentity(pathStats))) {
                throw new Error(tl.loc(errorMessageKey, filePath));
            }

            return {
                handle: fileHandle,
                identity: this.getIdentity(openedStats),
                mode: Number(openedStats.mode) & 0o777
            };
        } catch (error) {
            fs.closeSync(fileHandle);
            throw error;
        }
    }

    private copyFileContents(sourceHandle: number, destinationHandle: number): void {
        const buffer = Buffer.allocUnsafe(64 * 1024);
        let bytesRead: number;
        while ((bytesRead = fs.readSync(sourceHandle, buffer, 0, buffer.length, null)) > 0) {
            let offset = 0;
            while (offset < bytesRead) {
                const bytesWritten = fs.writeSync(
                    destinationHandle,
                    buffer,
                    offset,
                    bytesRead - offset,
                    null
                );
                if (bytesWritten === 0) {
                    throw new Error('Unable to write file contents.');
                }
                offset += bytesWritten;
            }
        }
    }

    private getIdentity(stats: fs.BigIntStats): FileIdentity {
        return {
            device: stats.dev.toString(),
            inode: stats.ino.toString()
        };
    }

    private hasIdentity(stats: fs.BigIntStats | FileIdentity, identity: FileIdentity): boolean {
        const actualIdentity = 'dev' in stats ? this.getIdentity(stats) : stats;
        return actualIdentity.device === identity.device && actualIdentity.inode === identity.inode;
    }

    static fromBackupDirectory(backupDirectory: string): NpmrcBackupManager {
        return new NpmrcBackupManager(backupDirectory);
    }
}
