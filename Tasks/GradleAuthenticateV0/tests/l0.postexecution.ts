// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as assert from 'assert';

describe('GradleAuthenticate L0 - Post-Execution Cleanup', function () {
    this.timeout(20000);

    afterEach(() => {
        delete process.env['__postexec_initScriptPath__'];
        delete process.env['__postexec_tempDir__'];
    });

    it('should complete successfully when no paths are set', async () => {
        const tp = path.join(__dirname, 'testsetup.postexecution.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert.strictEqual(tr.succeeded, true,
            `Task should have succeeded.\nStdout:\n${tr.stdout}\nStderr:\n${tr.stderr}`);
        assert.ok(tr.stdout.indexOf('Info_PostExecUnsetVars') >= 0,
            `Expected unset vars message.\nStdout:\n${tr.stdout}`);
    });

    it('should delete init script when path is set', async () => {
        // Create a temp init script to verify deletion
        const tempInitScript = path.join(os.tmpdir(), `test-init-${process.pid}.gradle`);
        fs.writeFileSync(tempInitScript, '// test init script');

        const tp = path.join(__dirname, 'testsetup.postexecution.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env['__postexec_initScriptPath__'] = tempInitScript;

        await tr.runAsync();

        assert.strictEqual(tr.succeeded, true,
            `Task should have succeeded.\nStdout:\n${tr.stdout}\nStderr:\n${tr.stderr}`);
        assert.ok(tr.stdout.indexOf('Info_PostExecDeletedInitScript') >= 0,
            `Expected init script deletion message.\nStdout:\n${tr.stdout}`);
        assert.strictEqual(fs.existsSync(tempInitScript), false,
            'Init script should have been deleted');
    });

    it('should delete temp directory when path is set', async () => {
        // Create a temp directory to verify deletion
        const tempDir = path.join(os.tmpdir(), `test-gradle-auth-${process.pid}`);
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test');

        const tp = path.join(__dirname, 'testsetup.postexecution.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env['__postexec_tempDir__'] = tempDir;

        await tr.runAsync();

        assert.strictEqual(tr.succeeded, true,
            `Task should have succeeded.\nStdout:\n${tr.stdout}\nStderr:\n${tr.stderr}`);
        assert.ok(tr.stdout.indexOf('Info_PostExecDeletedTempDir') >= 0,
            `Expected temp dir deletion message.\nStdout:\n${tr.stdout}`);
        assert.strictEqual(fs.existsSync(tempDir), false,
            'Temp directory should have been deleted');
    });
});
