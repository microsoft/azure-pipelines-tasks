import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('FtpUploadV2 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT!) || 20000);

    it('check args: no serverEndpoint', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoServerEndpoint.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: serverEndpoint'), 'Should have printed: Input required: serverEndpoint');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no rootFolder', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoRootFolder.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: rootFolder'), 'Should have printed: Input required: rootFolder');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no filePatterns', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoFilePatterns.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: filePatterns'), 'Should have printed: Input required: filePatterns');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no remotePath', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoRemotePath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: remotePath'), 'Should have printed: Input required: remotePath');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no clean', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoClean.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: clean'), 'Should have printed: Input required: clean');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no preservePaths', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoPreservePaths.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: preservePaths'), 'Should have printed: Input required: preservePaths');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no trustSSL', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoTrustSSL.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.stdOutContained('Input required: trustSSL'), 'Should have printed: Input required: trustSSL');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no protocol on server URL (ftp:// or ftps://)', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoProtocol.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_FTPNoProtocolSpecified'), 'Should have printed: loc_mock_FTPNoProtocolSpecified');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no host name on server URL', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoHostName.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_FTPNoHostSpecified'), 'Should have printed: loc_mock_FTPNoHostSpecified');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no files found', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoFilesFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_NoFilesFound'), 'Should have printed: loc_mock_NoFilesFound');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('task should complete successfully', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0Successful.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        console.info(tr.stdout);
        assert(tr.succeeded, 'task should succeed');

        done();
    });
});
