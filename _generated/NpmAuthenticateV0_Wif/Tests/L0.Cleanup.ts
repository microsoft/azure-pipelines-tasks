import * as path from 'path';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a SAVE_NPMRC_PATH directory containing an index.json and a backup file
 * in the format NpmrcBackupManager expects: { "index": 1, "<npmrcPath>": 0 }
 * with a file named "0" holding the original .npmrc content.
 */
function createSaveDir(npmrcPath: string, originalContent: string = 'original=https://registry.npmjs.org/\n'): string {
    const saveDir = TestHelpers.createTempDir('npm-auth-save-');
    const index: { [key: string]: number } = { index: 1 };
    index[npmrcPath] = 0;
    fs.writeFileSync(path.join(saveDir, 'index.json'), JSON.stringify(index), 'utf8');
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
        const tp = path.join(__dirname, 'TestSetupCleanup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.cleanupNpmrcPath]      = npmrcPath;
        process.env[TestEnvVars.cleanupSaveNpmrcPath]  = saveDir;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        // Verify the file was physically restored
        const restoredContent = fs.readFileSync(npmrcPath, 'utf8');
        TestHelpers.assertNpmrcContains(npmrcPath, 'registry=https://registry.npmjs.org/');
    });

    it('logs NoIndexJsonFile when index.json is missing from SAVE_NPMRC_PATH', async () => {
        // Arrange — save dir exists but index.json is absent
        const npmrcPath = TestHelpers.createTempNpmrc();
        const saveDir   = TestHelpers.createTempDir('npm-auth-save-');   // no index.json written
        const tp = path.join(__dirname, 'TestSetupCleanup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.cleanupNpmrcPath]       = npmrcPath;
        process.env[TestEnvVars.cleanupSaveNpmrcPath]   = saveDir;
        process.env[TestEnvVars.cleanupIndexShouldExist] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        TestHelpers.assertOutputContains(tr, 'loc_mock_NoIndexJsonFile');
    });

    it('logs NoIndexJsonFile when the working .npmrc file does not exist', async () => {
        // Arrange — index.json is present but the .npmrc it references is gone
        const npmrcPath = TestHelpers.createTempNpmrc();
        const saveDir   = createSaveDir(npmrcPath);
        const tp = path.join(__dirname, 'TestSetupCleanup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.cleanupNpmrcPath]        = npmrcPath;
        process.env[TestEnvVars.cleanupSaveNpmrcPath]    = saveDir;
        process.env[TestEnvVars.cleanupNpmrcShouldExist] = 'false';   // simulate deleted .npmrc

        // Act
        await tr.runAsync();

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
        const tp = path.join(__dirname, 'TestSetupCleanup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.cleanupNpmrcPath]       = npmrcPath;
        process.env[TestEnvVars.cleanupSaveNpmrcPath]   = saveDir;
        process.env[TestEnvVars.cleanupTempDirectory]   = tempDir;
        process.env[TestEnvVars.cleanupTempDirExists]   = 'true';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
    });
});
