import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

// Tracks which .npmrc files have been backed up so that npmauthcleanup can
// restore them.  The first snapshot per file is kept; subsequent calls for
// the same path are no-ops.

export class NpmrcBackupManager {
    private readonly indexFilePath: string;
    private nextId: number;
    private entries: { [npmrcPath: string]: number };

    constructor(private readonly backupDirectory: string) {
        this.indexFilePath = path.join(backupDirectory, 'index.json');
        const data = this.loadOrCreateIndex();
        this.nextId = data.nextId;
        this.entries = data.entries;
    }

    ensureBackedUp(npmrcPath: string): void {
        if (this.entries[npmrcPath] !== undefined) {
            return;
        }
        const entryId = this.nextId++;
        this.entries[npmrcPath] = entryId;
        this.saveIndex();
        this.saveFileWithName(npmrcPath, entryId);
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

        fs.copyFileSync(backupPath, npmrcPath);
        fs.unlinkSync(backupPath);
        return true;
    }

    isOnlyIndexFileRemaining(): boolean {
        return fs.readdirSync(this.backupDirectory).length === 1;
    }

    private loadOrCreateIndex(): { nextId: number; entries: { [npmrcPath: string]: number } } {
        if (fs.existsSync(this.indexFilePath)) {
            return JSON.parse(fs.readFileSync(this.indexFilePath, 'utf8'));
        }
        return { nextId: 0, entries: {} };
    }

    private saveIndex(): void {
        fs.writeFileSync(this.indexFilePath, JSON.stringify({ nextId: this.nextId, entries: this.entries }));
    }

    private getBackupFilePath(entryId: number | string): string {
        return path.join(this.backupDirectory, String(entryId));
    }

    private saveFileWithName(sourcePath: string, entryId: number | string): void {
        const backupPath = this.getBackupFilePath(entryId);
        tl.debug(tl.loc('SavingFile', sourcePath));
        fs.copyFileSync(sourcePath, backupPath);
    }

    static fromBackupDirectory(backupDirectory: string): NpmrcBackupManager {
        return new NpmrcBackupManager(backupDirectory);
    }
}
