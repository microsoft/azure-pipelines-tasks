import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DockerInstallerV0 Suite', function () {
    this.timeout(60000);

    it('Runs successfully with default inputs', async () => {
        const tp = path.join(__dirname, 'L0InstallDockerDefault.js');
        if (fs.existsSync(tp)) {
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
        }
    });

    it('Fails when docker download fails', async () => {
        const tp = path.join(__dirname, 'L0InstallDockerFail.js');
        if (fs.existsSync(tp)) {
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(tr.failed, 'task should have failed');
        }
    });
});
