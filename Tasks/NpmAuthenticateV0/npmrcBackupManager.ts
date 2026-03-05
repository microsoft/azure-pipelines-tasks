/**
 * npmrcBackupManager.ts
 *
 * Tracks which .npmrc files have been backed up during this pipeline run so
 * that npmauthcleanup can restore them to their original state.  State is
 * persisted to an index.json file inside the agent temp directory so that
 * multiple consecutive calls to NpmAuthenticate on the same .npmrc are
 * idempotent (the very first snapshot is kept and used for the final restore).
 */

import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

export class NpmrcBackupManager {
    private readonly indexFilePath: string;
    private index: { [key: string]: number };

    constructor(private readonly saveNpmrcPath: string) {
        this.indexFilePath = path.join(saveNpmrcPath, 'index.json');
        this.index = this.loadOrCreateIndex();
    }

    /** Backs up `npmrcPath` if it has not already been backed up this run. */
    ensureBackedUp(npmrcPath: string): void {
        if (this.index[npmrcPath] !== undefined) {
            return;
        }
        const entryId = this.index['index']++;
        this.index[npmrcPath] = entryId;
        this.saveIndex();
        this.saveFileWithName(npmrcPath, entryId);
    }

    restoreBackedUpFile(npmrcPath: string): boolean {
        const entryId = this.index[npmrcPath];
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
        return fs.readdirSync(this.saveNpmrcPath).length === 1;
    }

    private loadOrCreateIndex(): { [key: string]: number } {
        if (fs.existsSync(this.indexFilePath)) {
            return JSON.parse(fs.readFileSync(this.indexFilePath, 'utf8'));
        }
        return { index: 0 };
    }

    private saveIndex(): void {
        fs.writeFileSync(this.indexFilePath, JSON.stringify(this.index));
    }

    private getBackupFilePath(entryId: number | string): string {
        return path.join(this.saveNpmrcPath, String(entryId));
    }

    private saveFileWithName(sourcePath: string, entryId: number | string): void {
        const backupPath = this.getBackupFilePath(entryId);
        tl.debug(tl.loc('SavingFile', sourcePath));
        fs.copyFileSync(sourcePath, backupPath);
    }

    static fromSaveDirectory(saveNpmrcPath: string): NpmrcBackupManager {
        return new NpmrcBackupManager(saveNpmrcPath);
    }
}
