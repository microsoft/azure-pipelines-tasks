"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NpmrcBackupManager = exports.NpmrcFileIdentityTaskVariable = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const tl = __importStar(require("azure-pipelines-task-lib/task"));
exports.NpmrcFileIdentityTaskVariable = 'NPM_AUTHENTICATE_FILE_IDENTITY';
// Tracks which .npmrc files have been backed up so that npmauthcleanup can
// restore them. The first snapshot per file is kept; subsequent calls validate
// that the path still resolves to the same regular file.
class NpmrcBackupManager {
    constructor(backupDirectory) {
        this.backupDirectory = backupDirectory;
        this.indexFilePath = path.join(backupDirectory, 'index.json');
        const data = this.loadOrCreateIndex();
        this.nextId = data.nextId;
        this.entries = data.entries;
        this.identities = data.identities || {};
    }
    ensureBackedUp(npmrcPath) {
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
    restoreBackedUpFile(npmrcPath, trustedIdentity) {
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
                this.copyFileContents(backupHandle, destinationHandle, npmrcPath);
            }
            finally {
                fs.closeSync(destinationHandle);
            }
        }
        finally {
            fs.closeSync(backupHandle);
        }
        fs.unlinkSync(backupPath);
        return true;
    }
    isOnlyIndexFileRemaining() {
        return fs.readdirSync(this.backupDirectory).length === 1;
    }
    loadOrCreateIndex() {
        if (fs.existsSync(this.indexFilePath)) {
            return JSON.parse(fs.readFileSync(this.indexFilePath, 'utf8'));
        }
        return { nextId: 0, entries: {}, identities: {} };
    }
    saveIndex() {
        fs.writeFileSync(this.indexFilePath, JSON.stringify({
            nextId: this.nextId,
            entries: this.entries,
            identities: this.identities
        }));
    }
    getBackupFilePath(entryId) {
        return path.join(this.backupDirectory, String(entryId));
    }
    saveFileWithName(sourcePath, entryId) {
        const backupPath = this.getBackupFilePath(entryId);
        tl.debug(tl.loc('SavingFile', sourcePath));
        const source = this.openRegularFile(sourcePath, 'NpmrcMustBeRegularFile');
        try {
            const backupHandle = fs.openSync(backupPath, 'w', source.mode);
            try {
                this.copyFileContents(source.handle, backupHandle, backupPath);
                fs.fchmodSync(backupHandle, source.mode);
            }
            finally {
                fs.closeSync(backupHandle);
            }
        }
        finally {
            fs.closeSync(source.handle);
        }
        return source.identity;
    }
    getRegularFileIdentity(filePath, errorMessageKey) {
        const file = this.openRegularFile(filePath, errorMessageKey);
        try {
            return file.identity;
        }
        finally {
            fs.closeSync(file.handle);
        }
    }
    openRegularFile(filePath, errorMessageKey) {
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
        }
        catch (error) {
            fs.closeSync(fileHandle);
            throw error;
        }
    }
    copyFileContents(sourceHandle, destinationHandle, destinationPath) {
        const buffer = Buffer.allocUnsafe(64 * 1024);
        let bytesRead;
        while ((bytesRead = fs.readSync(sourceHandle, buffer, 0, buffer.length, null)) > 0) {
            let offset = 0;
            while (offset < bytesRead) {
                const bytesWritten = fs.writeSync(destinationHandle, buffer, offset, bytesRead - offset, null);
                if (bytesWritten === 0) {
                    throw new Error(tl.loc('UnableToWriteFileContents', destinationPath));
                }
                offset += bytesWritten;
            }
        }
    }
    getIdentity(stats) {
        return {
            device: stats.dev.toString(),
            inode: stats.ino.toString()
        };
    }
    hasIdentity(stats, identity) {
        const actualIdentity = 'dev' in stats ? this.getIdentity(stats) : stats;
        return actualIdentity.device === identity.device && actualIdentity.inode === identity.inode;
    }
    static fromBackupDirectory(backupDirectory) {
        return new NpmrcBackupManager(backupDirectory);
    }
}
exports.NpmrcBackupManager = NpmrcBackupManager;
