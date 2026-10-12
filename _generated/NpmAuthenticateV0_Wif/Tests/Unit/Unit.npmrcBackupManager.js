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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const npmrcBackupManager_1 = require("../../npmrcBackupManager");
tl.setResourcePath(path.join(__dirname, '..', '..', 'task.json'));
describe('NpmAuthenticateV0 Unit - npmrcBackupManager', function () {
    it('backs up and restores a file', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'registry=https://registry.npmjs.org/\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.writeFileSync(npmrcPath, 'registry=https://override.example/\n', 'utf8');
            const restored = manager.restoreBackedUpFile(npmrcPath);
            assert_1.default.strictEqual(restored, true);
            const restoredContent = fs.readFileSync(npmrcPath, 'utf8');
            (0, assert_1.default)(restoredContent.includes('registry=https://registry.npmjs.org/'));
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('backs up and restores content larger than the copy buffer', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            const originalContent = Buffer.alloc((64 * 1024 * 2) + 17, 0x61);
            fs.writeFileSync(npmrcPath, originalContent);
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            const trustedIdentity = manager.ensureBackedUp(npmrcPath);
            fs.writeFileSync(npmrcPath, 'modified\n', 'utf8');
            const restored = manager.restoreBackedUpFile(npmrcPath, trustedIdentity);
            assert_1.default.strictEqual(restored, true);
            assert_1.default.deepStrictEqual(fs.readFileSync(npmrcPath), originalContent);
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('does not overwrite first snapshot when ensureBackedUp is called twice', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'first\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.writeFileSync(npmrcPath, 'second\n', 'utf8');
            manager.ensureBackedUp(npmrcPath);
            fs.writeFileSync(npmrcPath, 'third\n', 'utf8');
            const restored = manager.restoreBackedUpFile(npmrcPath);
            assert_1.default.strictEqual(restored, true);
            assert_1.default.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'first\n');
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('revalidates the working file when ensureBackedUp is called again', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            const targetPath = path.join(sourceDir, 'target');
            fs.writeFileSync(npmrcPath, 'original\n', 'utf8');
            fs.writeFileSync(targetPath, 'host-only\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.unlinkSync(npmrcPath);
            try {
                fs.symlinkSync(targetPath, npmrcPath, 'file');
            }
            catch (error) {
                if (error.code === 'EPERM') {
                    this.skip();
                    return;
                }
                throw error;
            }
            const laterManager = npmrcBackupManager_1.NpmrcBackupManager.fromBackupDirectory(root);
            assert_1.default.throws(() => laterManager.ensureBackedUp(npmrcPath), /must be a regular file/);
            assert_1.default.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'host-only\n');
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('rejects a symbolic link when backing up a file', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const targetPath = path.join(sourceDir, 'target');
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(targetPath, 'host-only\n', 'utf8');
            try {
                fs.symlinkSync(targetPath, npmrcPath, 'file');
            }
            catch (error) {
                if (error.code === 'EPERM') {
                    this.skip();
                    return;
                }
                throw error;
            }
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            assert_1.default.throws(() => manager.ensureBackedUp(npmrcPath), /must be a regular file/);
            assert_1.default.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'host-only\n');
            assert_1.default.deepStrictEqual(fs.readdirSync(root), []);
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('rejects a symbolic link without modifying its target when restoring a file', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            const targetPath = path.join(sourceDir, 'target');
            fs.writeFileSync(npmrcPath, 'original\n', 'utf8');
            fs.writeFileSync(targetPath, 'host-only\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.unlinkSync(npmrcPath);
            try {
                fs.symlinkSync(targetPath, npmrcPath, 'file');
            }
            catch (error) {
                if (error.code === 'EPERM') {
                    this.skip();
                    return;
                }
                throw error;
            }
            assert_1.default.throws(() => manager.restoreBackedUpFile(npmrcPath), /no longer the same regular file/);
            assert_1.default.strictEqual(fs.lstatSync(npmrcPath).isSymbolicLink(), true);
            assert_1.default.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'host-only\n');
            assert_1.default.strictEqual(fs.readFileSync(path.join(root, '0'), 'utf8'), 'original\n');
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('rejects a replacement regular file with a different identity when restoring', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'original\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            // Keep the original inode allocated so the replacement cannot reuse it.
            fs.renameSync(npmrcPath, path.join(sourceDir, 'original.npmrc'));
            fs.writeFileSync(npmrcPath, 'replacement\n', 'utf8');
            assert_1.default.notStrictEqual(fs.statSync(npmrcPath, { bigint: true }).ino, fs.statSync(path.join(sourceDir, 'original.npmrc'), { bigint: true }).ino);
            assert_1.default.throws(() => manager.restoreBackedUpFile(npmrcPath), /no longer the same regular file/);
            assert_1.default.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'replacement\n');
            assert_1.default.strictEqual(fs.readFileSync(path.join(root, '0'), 'utf8'), 'original\n');
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('reports a localized error and keeps the backup when restore cannot write', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        const nodeFs = require('fs');
        const originalWriteSync = nodeFs.writeSync;
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'original\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.writeFileSync(npmrcPath, 'modified\n', 'utf8');
            nodeFs.writeSync = () => 0;
            assert_1.default.throws(() => manager.restoreBackedUpFile(npmrcPath), (error) => error.message === tl.loc('UnableToWriteFileContents', npmrcPath));
            nodeFs.writeSync = originalWriteSync;
            assert_1.default.strictEqual(fs.readFileSync(path.join(root, '0'), 'utf8'), 'original\n');
        }
        finally {
            nodeFs.writeSync = originalWriteSync;
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('uses the trusted task identity instead of changed index metadata during restore', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'original\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            const trustedIdentity = manager.ensureBackedUp(npmrcPath);
            // Keep the original inode allocated so the replacement cannot reuse it.
            fs.renameSync(npmrcPath, path.join(sourceDir, 'original.npmrc'));
            fs.writeFileSync(npmrcPath, 'replacement\n', 'utf8');
            const replacementStats = fs.statSync(npmrcPath, { bigint: true });
            assert_1.default.notStrictEqual(replacementStats.ino.toString(), trustedIdentity.inode);
            const indexPath = path.join(root, 'index.json');
            const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            index.identities[npmrcPath] = {
                device: replacementStats.dev.toString(),
                inode: replacementStats.ino.toString()
            };
            fs.writeFileSync(indexPath, JSON.stringify(index), 'utf8');
            const cleanupManager = npmrcBackupManager_1.NpmrcBackupManager.fromBackupDirectory(root);
            assert_1.default.throws(() => cleanupManager.restoreBackedUpFile(npmrcPath, trustedIdentity), /no longer the same regular file/);
            assert_1.default.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'replacement\n');
            assert_1.default.strictEqual(fs.readFileSync(path.join(root, '0'), 'utf8'), 'original\n');
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('restores the original file in place', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            const linkedPath = path.join(sourceDir, 'linked-npmrc');
            fs.writeFileSync(npmrcPath, 'original\n', 'utf8');
            fs.linkSync(npmrcPath, linkedPath);
            const originalStats = fs.statSync(npmrcPath);
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.writeFileSync(npmrcPath, 'modified\n', 'utf8');
            const restored = manager.restoreBackedUpFile(npmrcPath);
            assert_1.default.strictEqual(restored, true);
            assert_1.default.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'original\n');
            assert_1.default.strictEqual(fs.readFileSync(linkedPath, 'utf8'), 'original\n');
            assert_1.default.strictEqual(fs.statSync(npmrcPath).ino, originalStats.ino);
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('returns false when restore is requested for an untracked file', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        try {
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            const restored = manager.restoreBackedUpFile(path.join(root, '.npmrc'));
            assert_1.default.strictEqual(restored, false);
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
    it('returns false when backup entry exists but backup file is missing', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'value\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.rmSync(path.join(root, '0'), { force: true });
            const restored = manager.restoreBackedUpFile(npmrcPath);
            assert_1.default.strictEqual(restored, false);
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('restores an ordinary file from a legacy numeric-only index', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'modified\n', 'utf8');
            fs.writeFileSync(path.join(root, '0'), 'original\n', 'utf8');
            fs.writeFileSync(path.join(root, 'index.json'), JSON.stringify({
                nextId: 1,
                entries: { [npmrcPath]: 0 }
            }));
            const manager = npmrcBackupManager_1.NpmrcBackupManager.fromBackupDirectory(root);
            const restored = manager.restoreBackedUpFile(npmrcPath);
            assert_1.default.strictEqual(restored, true);
            assert_1.default.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'original\n');
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
    it('detects when only index.json remains', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'registry=https://registry.npmjs.org/\n', 'utf8');
            const manager = new npmrcBackupManager_1.NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            assert_1.default.strictEqual(manager.isOnlyIndexFileRemaining(), false);
            manager.restoreBackedUpFile(npmrcPath);
            assert_1.default.strictEqual(manager.isOnlyIndexFileRemaining(), true);
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
});
