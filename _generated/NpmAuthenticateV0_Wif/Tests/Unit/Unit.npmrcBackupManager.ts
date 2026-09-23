import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { NpmrcBackupManager } from '../../npmrcBackupManager';

tl.setResourcePath(path.join(__dirname, '..', '..', 'task.json'));

describe('NpmAuthenticateV0 Unit - npmrcBackupManager', function () {
    it('backs up and restores a file', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'registry=https://registry.npmjs.org/\n', 'utf8');

            const manager = new NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);

            fs.writeFileSync(npmrcPath, 'registry=https://override.example/\n', 'utf8');
            const restored = manager.restoreBackedUpFile(npmrcPath);

            assert.strictEqual(restored, true);
            const restoredContent = fs.readFileSync(npmrcPath, 'utf8');
            assert(restoredContent.includes('registry=https://registry.npmjs.org/'));
        } finally {
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

            const manager = new NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);

            fs.writeFileSync(npmrcPath, 'second\n', 'utf8');
            manager.ensureBackedUp(npmrcPath);

            fs.writeFileSync(npmrcPath, 'third\n', 'utf8');
            const restored = manager.restoreBackedUpFile(npmrcPath);

            assert.strictEqual(restored, true);
            assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'first\n');
        } finally {
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
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'EPERM') {
                    this.skip();
                    return;
                }
                throw error;
            }

            const manager = new NpmrcBackupManager(root);
            assert.throws(
                () => manager.ensureBackedUp(npmrcPath),
                /must be a regular file/
            );
            assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'host-only\n');
            assert.deepStrictEqual(fs.readdirSync(root), []);
        } finally {
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

            const manager = new NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.unlinkSync(npmrcPath);
            try {
                fs.symlinkSync(targetPath, npmrcPath, 'file');
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'EPERM') {
                    this.skip();
                    return;
                }
                throw error;
            }

            assert.throws(
                () => manager.restoreBackedUpFile(npmrcPath),
                /no longer the same regular file/
            );
            assert.strictEqual(fs.lstatSync(npmrcPath).isSymbolicLink(), true);
            assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'host-only\n');
            assert.strictEqual(fs.readFileSync(path.join(root, '0'), 'utf8'), 'original\n');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });

    it('rejects a replacement regular file when restoring a file', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'original\n', 'utf8');

            const manager = new NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.unlinkSync(npmrcPath);
            fs.writeFileSync(npmrcPath, 'replacement\n', 'utf8');

            assert.throws(
                () => manager.restoreBackedUpFile(npmrcPath),
                /no longer the same regular file/
            );
            assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'replacement\n');
            assert.strictEqual(fs.readFileSync(path.join(root, '0'), 'utf8'), 'original\n');
        } finally {
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

            const manager = new NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);
            fs.writeFileSync(npmrcPath, 'modified\n', 'utf8');

            const restored = manager.restoreBackedUpFile(npmrcPath);

            assert.strictEqual(restored, true);
            assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'original\n');
            assert.strictEqual(fs.readFileSync(linkedPath, 'utf8'), 'original\n');
            assert.strictEqual(fs.statSync(npmrcPath).ino, originalStats.ino);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });

    it('returns false when restore is requested for an untracked file', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        try {
            const manager = new NpmrcBackupManager(root);
            const restored = manager.restoreBackedUpFile(path.join(root, '.npmrc'));

            assert.strictEqual(restored, false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('returns false when backup entry exists but backup file is missing', function () {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-bak-'));
        const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-src-'));
        try {
            const npmrcPath = path.join(sourceDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'value\n', 'utf8');

            const manager = new NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);

            fs.rmSync(path.join(root, '0'), { force: true });
            const restored = manager.restoreBackedUpFile(npmrcPath);

            assert.strictEqual(restored, false);
        } finally {
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

            const manager = NpmrcBackupManager.fromBackupDirectory(root);
            const restored = manager.restoreBackedUpFile(npmrcPath);

            assert.strictEqual(restored, true);
            assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'original\n');
        } finally {
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

            const manager = new NpmrcBackupManager(root);
            manager.ensureBackedUp(npmrcPath);

            assert.strictEqual(manager.isOnlyIndexFileRemaining(), false);
            manager.restoreBackedUpFile(npmrcPath);
            assert.strictEqual(manager.isOnlyIndexFileRemaining(), true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
    });
});
