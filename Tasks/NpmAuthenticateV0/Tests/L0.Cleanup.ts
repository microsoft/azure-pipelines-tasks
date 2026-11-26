import assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { NpmrcBackupManager } from '../npmrcBackupManager';
import { TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a SAVE_NPMRC_PATH directory containing an index.json and a backup file
 * in the format NpmrcBackupManager expects: { "nextId": 1, "entries": { "<npmrcPath>": 0 } }
 * with a file named "0" holding the original .npmrc content.
 */
function createSaveDir(npmrcPath: string, originalContent: string = 'original=https://registry.npmjs.org/\n'): string {
    const saveDir = TestHelpers.createTempDir('npm-auth-save-');
    const npmrcStats = fs.statSync(npmrcPath, { bigint: true });
    const index = {
        nextId: 1,
        entries: { [npmrcPath]: 0 },
        identities: {
            [npmrcPath]: {
                device: npmrcStats.dev.toString(),
                inode: npmrcStats.ino.toString()
            }
        }
    };
    fs.writeFileSync(path.join(saveDir, 'index.json'), JSON.stringify(index), 'utf8');
    process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'] =
        JSON.stringify(index.identities[npmrcPath]);
    // Create the backup file that restoreBackedUpFile() will copy back
    fs.writeFileSync(path.join(saveDir, '0'), originalContent, 'utf8');
    return saveDir;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NpmAuthenticate L0 - Cleanup', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('restores the .npmrc when index.json and working file both exist', async () => {
        // Arrange
        const originalContent = 'registry=https://registry.npmjs.org/\n';
        const npmrcPath = TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir   = createSaveDir(npmrcPath, originalContent);

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
        }, 'TestSetupCleanup.js');

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        // Verify the file was physically restored
        const restoredContent = fs.readFileSync(npmrcPath, 'utf8');
        TestHelpers.assertNpmrcContains(npmrcPath, 'registry=https://registry.npmjs.org/');
    });

    for (const serializedIdentity of [undefined, '{', 'null', '{}', '{"device":1,"inode":"2"}']) {
        it(`warns without restoring when the trusted file identity is invalid: ${serializedIdentity}`, async () => {
            const npmrcPath = TestHelpers.createTempNpmrc('modified-by-task');
            const saveDir = createSaveDir(npmrcPath);
            if (serializedIdentity === undefined) {
                delete process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'];
            } else {
                process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'] = serializedIdentity;
            }

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
                [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
            }, 'TestSetupCleanup.js');

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertWarningIssue(tr, 'loc_mock_Warning_NpmrcIdentityUnavailable');
            TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
            assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'modified-by-task');
            assert.strictEqual(fs.existsSync(path.join(saveDir, '0')), true);
        });
    }

    it('still fails when the backup index cannot be parsed', async () => {
        const npmrcPath = TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir = createSaveDir(npmrcPath);
        fs.writeFileSync(path.join(saveDir, 'index.json'), '{');

        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
        }, 'TestSetupCleanup.js');

        TestHelpers.assertFailure(tr);
        TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'modified-by-task');
        assert.strictEqual(fs.existsSync(path.join(saveDir, '0')), true);
    });

    for (const command of [['checkout', '--', '.npmrc'], ['reset', '--hard', 'HEAD']]) {
        it(`warns without overwriting a file replaced by git ${command[0]}`, async () => {
            const directory = TestHelpers.createTempDir('npm-auth-git-');
            const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
            git('init');
            git('config', 'core.autocrlf', 'false');
            const npmrcPath = path.join(directory, '.npmrc');
            const originalContent = 'registry=https://registry.npmjs.org/\n';
            fs.writeFileSync(npmrcPath, originalContent);
            git('add', '.npmrc');
            git('-c', 'user.name=Task Test', '-c', 'user.email=task-test@example.invalid',
                '-c', 'commit.gpgsign=false', 'commit', '-m', 'Add npm configuration');
            const saveDir = createSaveDir(npmrcPath, originalContent);
            const serializedIdentity = process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'];
            const identity = fs.statSync(npmrcPath, { bigint: true }).ino;
            fs.appendFileSync(npmrcPath, '//registry.npmjs.org/:_authToken=test-only\n');
            // Keep the original file allocated to prevent inode reuse.
            const originalPath = path.join(directory, 'authenticated.npmrc');
            fs.linkSync(npmrcPath, originalPath);
            git(...command);
            assert.notStrictEqual(fs.statSync(npmrcPath, { bigint: true }).ino, identity);
            assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), originalContent);

            for (let cleanup = 0; cleanup < 2; cleanup++) {
                process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'] = serializedIdentity;
                const tr = await TestHelpers.runTestWithEnv({
                    [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
                    [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
                }, 'TestSetupCleanup.js');

                TestHelpers.assertSuccess(tr);
                TestHelpers.assertWarningIssue(tr, 'loc_mock_Warning_NpmrcRestoreSkipped');
                TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
                assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), originalContent);
                assert.strictEqual(fs.readFileSync(path.join(saveDir, '0'), 'utf8'), originalContent);
                assert(fs.readFileSync(originalPath, 'utf8').includes('_authToken=test-only'));
            }
        });
    }

    it('keeps other backups available after skipping a replaced file', async () => {
        const npmrcPath = TestHelpers.createTempNpmrc('first original\n');
        const otherPath = TestHelpers.createTempNpmrc('second original\n');
        const saveDir = TestHelpers.createTempDir('npm-auth-save-');
        const manager = new NpmrcBackupManager(saveDir);
        const firstIdentity = manager.ensureBackedUp(npmrcPath);
        const otherIdentity = manager.ensureBackedUp(otherPath);
        fs.renameSync(npmrcPath, npmrcPath + '.old');
        fs.writeFileSync(npmrcPath, 'replacement\n');
        fs.writeFileSync(otherPath, 'second authenticated\n');

        process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'] = JSON.stringify(firstIdentity);
        const skipped = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
        }, 'TestSetupCleanup.js');
        TestHelpers.assertSuccess(skipped);
        TestHelpers.assertWarningIssue(skipped, 'loc_mock_Warning_NpmrcRestoreSkipped');

        process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'] = JSON.stringify(otherIdentity);
        const restored = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: otherPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
        }, 'TestSetupCleanup.js');
        TestHelpers.assertSuccess(restored);
        TestHelpers.assertOutputContains(restored, 'loc_mock_RevertedChangesToNpmrc');
        assert.strictEqual(fs.readFileSync(otherPath, 'utf8'), 'second original\n');
        assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'replacement\n');
        assert.strictEqual(fs.existsSync(path.join(saveDir, '0')), true);
        assert.strictEqual(fs.existsSync(path.join(saveDir, '1')), false);
    });

    for (const kind of ['symbolic link', 'directory', 'hard link']) {
        it(`does not overwrite a replacement ${kind}`, async function () {
            const npmrcPath = TestHelpers.createTempNpmrc('original\n');
            const targetPath = TestHelpers.createTempNpmrc('target unchanged\n');
            const saveDir = createSaveDir(npmrcPath);
            fs.renameSync(npmrcPath, npmrcPath + '.old');
            if (kind === 'symbolic link') {
                try {
                    fs.symlinkSync(targetPath, npmrcPath, 'file');
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
                        this.skip();
                        return;
                    }
                    throw error;
                }
            } else if (kind === 'directory') {
                fs.mkdirSync(npmrcPath);
            } else {
                fs.linkSync(targetPath, npmrcPath);
            }

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
                [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
            }, 'TestSetupCleanup.js');
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertWarningIssue(tr, 'loc_mock_Warning_NpmrcRestoreSkipped');
            TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
            assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'target unchanged\n');
            assert.strictEqual(fs.existsSync(path.join(saveDir, '0')), true);
        });
    }

    it('warns without restoring when backup contents fail integrity validation', async () => {
        const npmrcPath = TestHelpers.createTempNpmrc('original\n');
        const saveDir = TestHelpers.createTempDir('npm-auth-save-');
        const manager = new NpmrcBackupManager(saveDir);
        const identity = manager.ensureBackedUp(npmrcPath);
        process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'] = JSON.stringify(identity);
        fs.writeFileSync(npmrcPath, 'authenticated\n');
        fs.writeFileSync(path.join(saveDir, '0'), 'changed backup\n');

        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir
        }, 'TestSetupCleanup.js');

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertWarningIssue(tr, 'loc_mock_Warning_NpmrcBackupIntegrityMismatch');
        TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        assert.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'authenticated\n');
        assert.strictEqual(fs.readFileSync(path.join(saveDir, '0'), 'utf8'), 'changed backup\n');
    });

    it('logs NoIndexJsonFile when index.json is missing from SAVE_NPMRC_PATH', async () => {
        // Arrange — save dir exists but index.json is absent
        const npmrcPath = TestHelpers.createTempNpmrc();
        const saveDir   = TestHelpers.createTempDir('npm-auth-save-');   // no index.json written

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir,
            [TestEnvVars.cleanupIndexShouldExist]: 'false'
        }, 'TestSetupCleanup.js');

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        TestHelpers.assertOutputContains(tr, 'loc_mock_NoIndexJsonFile');
    });

    it('logs NoIndexJsonFile when the working .npmrc file does not exist', async () => {
        // Arrange — index.json is present but the .npmrc it references is gone
        const npmrcPath = TestHelpers.createTempNpmrc();
        const saveDir   = createSaveDir(npmrcPath);

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir,
            [TestEnvVars.cleanupNpmrcShouldExist]: 'false'
        }, 'TestSetupCleanup.js');

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        TestHelpers.assertOutputContains(tr, 'loc_mock_NoIndexJsonFile');
    });

    it('removes the temp directory when SAVE_NPMRC_PATH contains only the index file', async () => {
        // Arrange — after restore, only index.json remains so the rmRF branch triggers.
        // createSaveDir adds both index.json and the backup file "0".
        // After restoreBackedUpFile runs, it deletes "0", leaving only index.json.
        const npmrcPath = TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir   = createSaveDir(npmrcPath);
        const tempDir   = TestHelpers.createTempDir('npm-auth-temp-');

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestEnvVars.cleanupSaveNpmrcPath]: saveDir,
            [TestEnvVars.cleanupTempDirectory]: tempDir,
            [TestEnvVars.cleanupTempDirExists]: 'true'
        }, 'TestSetupCleanup.js');

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
    });
});
