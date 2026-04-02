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
