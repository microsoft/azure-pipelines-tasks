import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('FtpUploadV1 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('check args: no serverEndpoint', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoServerEndpoint.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_LIB_InputRequired serverEndpoint'), 'Should have printed: loc_mock_LIB_InputRequired serverEndpoint');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no rootFolder', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoRootFolder.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_LIB_InputRequired rootFolder'), 'Should have printed: loc_mock_LIB_InputRequired rootFolder');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no filePatterns', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoFilePatterns.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_LIB_InputRequired filePatterns'), 'Should have printed: loc_mock_LIB_InputRequired filePatterns');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no remotePath', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoRemotePath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_LIB_InputRequired remotePath'), 'Should have printed: loc_mock_LIB_InputRequired remotePath');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no clean', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoClean.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_LIB_InputRequired clean'), 'Should have printed: loc_mock_LIB_InputRequired clean');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no overwrite', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoOverwrite.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_LIB_InputRequired overwrite'), 'Should have printed: loc_mock_LIB_InputRequired overwrite');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no preservePaths', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoPreservePaths.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_LIB_InputRequired preservePaths'), 'Should have printed: loc_mock_LIB_InputRequired preservePaths');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no trustSSL', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoTrustSSL.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.stdOutContained('loc_mock_LIB_InputRequired trustSSL'), 'Should have printed: loc_mock_LIB_InputRequired trustSSL');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no protocol on server URL (ftp:// or ftps://)', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoProtocol.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('FTPNoProtocolSpecified'), 'Should have printed: FTPNoProtocolSpecified');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('check args: no host name on server URL', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoHostName.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('FTPNoHostSpecified'), 'Should have printed: FTPNoHostSpecified');
        assert(tr.failed, 'task should have failed');

        done();
    });
});
