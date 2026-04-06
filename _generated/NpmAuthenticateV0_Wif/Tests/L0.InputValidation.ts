import * as os from 'os';
import * as path from 'path';
import { TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Input Validation', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('fails when workingFile does not have an .npmrc extension', async () => {
        // Arrange: point workingFile at a non-.npmrc file path
        const notNpmrc = path.join(os.tmpdir(), 'package.json');

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: notNpmrc
        });

        // Assert: task must fail because the extension check fires before any file I/O
        TestHelpers.assertFailure(tr, 'Task should fail when workingFile does not end in .npmrc');
        TestHelpers.assertOutputContains(tr, 'NpmrcNotNpmrc');
    });

    it('fails when the .npmrc file does not exist on disk', async () => {
        // Arrange: valid .npmrc extension but file is not present
        const missingFile = path.join(os.tmpdir(), 'does-not-exist.npmrc');

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: missingFile,
            [TestEnvVars.npmrcShouldExist]: 'false'
        });

        // Assert
        TestHelpers.assertFailure(tr, 'Task should fail when the .npmrc file is missing');
        TestHelpers.assertOutputContains(tr, 'NpmrcDoesNotExist');
    });
});
