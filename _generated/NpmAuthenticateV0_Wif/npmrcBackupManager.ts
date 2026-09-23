import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

interface FileIdentity {
    device: string;
    inode: string;
}

// Tracks which .npmrc files have been backed up so that npmauthcleanup can
// restore them.  The first snapshot per file is kept; subsequent calls for
// the same path are no-ops.

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

    ensureBackedUp(npmrcPath: string): void {
        if (this.entries[npmrcPath] !== undefined) {
            if (!this.identities[npmrcPath]) {
                this.identities[npmrcPath] = this.readRegularFile(npmrcPath, 'NpmrcMustBeRegularFile').identity;
                this.saveIndex();
            }
            return;
        }
        const entryId = this.nextId;
        const identity = this.saveFileWithName(npmrcPath, entryId);
        this.nextId++;
        this.entries[npmrcPath] = entryId;
        this.identities[npmrcPath] = identity;
        this.saveIndex();
    }

    restoreBackedUpFile(npmrcPath: string): boolean {
        const entryId = this.entries[npmrcPath];
        if (entryId === undefined) {
            return false;
        }

        const backupPath = this.getBackupFilePath(entryId);
        if (!fs.existsSync(backupPath)) {
            return false;
        }

        const backupContents = fs.readFileSync(backupPath);
        const destinationStats = fs.lstatSync(npmrcPath, { bigint: true });
        const expectedIdentity = this.identities[npmrcPath];
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
            fs.writeFileSync(destinationHandle, backupContents);
        } finally {
            fs.closeSync(destinationHandle);
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
        const source = this.readRegularFile(sourcePath, 'NpmrcMustBeRegularFile');

        const backupHandle = fs.openSync(backupPath, 'w', source.mode);
        try {
            fs.writeFileSync(backupHandle, source.contents);
            fs.fchmodSync(backupHandle, source.mode);
        } finally {
            fs.closeSync(backupHandle);
        }
        return source.identity;
    }

    private readRegularFile(filePath: string, errorMessageKey: string): {
        contents: Buffer;
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
                contents: fs.readFileSync(fileHandle),
                identity: this.getIdentity(openedStats),
                mode: Number(openedStats.mode) & 0o777
            };
        } finally {
            fs.closeSync(fileHandle);
        }
    }

    private getIdentity(stats: fs.BigIntStats): FileIdentity {
        return {
            device: stats.dev.toString(),
            inode: stats.ino.toString()
        };
    }

    private hasIdentity(stats: fs.BigIntStats, identity: FileIdentity): boolean {
        return stats.dev.toString() === identity.device && stats.ino.toString() === identity.inode;
    }

    static fromBackupDirectory(backupDirectory: string): NpmrcBackupManager {
        return new NpmrcBackupManager(backupDirectory);
    }
}
