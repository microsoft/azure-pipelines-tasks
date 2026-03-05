import * as path from 'path';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a SAVE_NPMRC_PATH directory containing an index.json whose entry for
 * `npmrcPath` maps to a placeholder original content string.
 * The directory is tracked via TestHelpers so afterEach() cleans it up.
 */
function createSaveDir(npmrcPath: string): string {
    const saveDir = TestHelpers.createTempDir('npm-auth-save-');
    const indexContent: { [key: string]: string } = {};
    indexContent[npmrcPath] = 'original=https://registry.npmjs.org/\n';
    fs.writeFileSync(path.join(saveDir, 'index.json'), JSON.stringify(indexContent), 'utf8');
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
        const npmrcPath = TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir   = createSaveDir(npmrcPath);
        const tp = path.join(__dirname, 'TestSetupCleanup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.cleanupNpmrcPath]      = npmrcPath;
        process.env[TestEnvVars.cleanupSaveNpmrcPath]  = saveDir;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'RESTORE_FILE_CALLED');
        TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
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
        TestHelpers.assertOutputNotContains(tr, 'RESTORE_FILE_CALLED');
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
        TestHelpers.assertOutputNotContains(tr, 'RESTORE_FILE_CALLED');
        TestHelpers.assertOutputContains(tr, 'loc_mock_NoIndexJsonFile');
    });

    it('removes the temp directory when SAVE_NPMRC_PATH contains only the index file', async () => {
        // Arrange — save dir has exactly 1 file (index.json) so the rmRF branch is reached
        const npmrcPath = TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir   = createSaveDir(npmrcPath);   // 1 file: index.json
        const tempDir   = TestHelpers.createTempDir('npm-auth-temp-');
        const tp = path.join(__dirname, 'TestSetupCleanup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.cleanupNpmrcPath]       = npmrcPath;
        process.env[TestEnvVars.cleanupSaveNpmrcPath]   = saveDir;
        process.env[TestEnvVars.cleanupTempDirectory]   = tempDir;
        process.env[TestEnvVars.cleanupTempDirExists]   = 'true';

        // Act
        await tr.runAsync();

        // Assert — task reaches the rmRF branch without throwing
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'RESTORE_FILE_CALLED');
        TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
    });
});
