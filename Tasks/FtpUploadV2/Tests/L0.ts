import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('FtpUploadV2 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT!) || 20000);

    it('check args: no serverEndpoint', async () => {
        const tp = path.join(__dirname, 'L0NoServerEndpoint.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: serverEndpoint'), 'Should have printed: Input required: serverEndpoint');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no rootFolder', async () => {
        const tp = path.join(__dirname, 'L0NoRootFolder.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: rootFolder'), 'Should have printed: Input required: rootFolder');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no filePatterns', async () => {
        const tp = path.join(__dirname, 'L0NoFilePatterns.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: filePatterns'), 'Should have printed: Input required: filePatterns');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no remotePath', async () => {
        const tp = path.join(__dirname, 'L0NoRemotePath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: remotePath'), 'Should have printed: Input required: remotePath');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no clean', async () => {
        const tp = path.join(__dirname, 'L0NoClean.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: clean'), 'Should have printed: Input required: clean');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no preservePaths', async () => {
        const tp = path.join(__dirname, 'L0NoPreservePaths.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: preservePaths'), 'Should have printed: Input required: preservePaths');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no trustSSL', async () => {
        const tp = path.join(__dirname, 'L0NoTrustSSL.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.stdOutContained('Input required: trustSSL'), 'Should have printed: Input required: trustSSL');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no protocol on server URL (ftp:// or ftps://)', async () => {
        const tp = path.join(__dirname, 'L0NoProtocol.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('loc_mock_FTPNoProtocolSpecified'), 'Should have printed: loc_mock_FTPNoProtocolSpecified');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no host name on server URL', async () => {
        const tp = path.join(__dirname, 'L0NoHostName.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('loc_mock_FTPNoHostSpecified'), 'Should have printed: loc_mock_FTPNoHostSpecified');
        assert(tr.failed, 'task should have failed');
    });

    it('check args: no files found', async () => {
        const tp = path.join(__dirname, 'L0NoFilesFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('loc_mock_NoFilesFound'), 'Should have printed: loc_mock_NoFilesFound');
        assert(tr.failed, 'task should have failed');
    });

    it('task should complete successfully', async () => {
        const tp = path.join(__dirname, 'L0Successful.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        console.info(tr.stdout);
        assert(tr.stdOutContained('ftp greeting ##_vso[task.setvariable variable=fromGreeting]unsafe'), 'FTP response output should be filtered');
        assert(tr.stdOutContained('ftp logger ##_vso[task.setvariable variable=fromLogger]unsafe'), 'FTP debug output should be filtered');
        assert(tr.stdOutContained('##_vso[task.setvariable variable=fromPattern]unsafe'), 'repository pattern output should be filtered');
        assert(tr.stdOutContained('##_vso[task.setvariable variable=fromFile]unsafe'), 'repository filename output should be filtered');
        assert(tr.stdOutContained('##_vso[task.setvariable variable=fromRemotePath]unsafe'), 'remote path output should be filtered');
        assert(!tr.stdOutContained('##vso[task.setvariable variable=fromGreeting]unsafe'), 'FTP response command should be neutralized');
        assert(!tr.stdOutContained('##vso[task.setvariable variable=fromLogger]unsafe'), 'FTP debug command should be neutralized');
        assert(!tr.stdOutContained('searching for files using: 2 filePatterns: **,##vso[task.setvariable variable=fromPattern]unsafe'), 'repository pattern log should not contain an executable command');
        assert(!tr.stdOutContained('file: rootFolder/##vso[task.setvariable variable=fromPattern]unsafe##vso[task.setvariable variable=fromFile]unsafe'), 'repository filename candidate log should not contain an executable command');
        assert(!tr.stdOutContained('file: rootFolder\\##vso[task.setvariable variable=fromPattern]unsafe##vso[task.setvariable variable=fromFile]unsafe'), 'repository filename upload log should not contain an executable command');
        assert(!tr.stdOutContained('loc_mock_CleanRemoteDir /upload/##vso[task.setvariable variable=fromRemotePath]unsafe'), 'remote path log should not contain an executable command');
        assert(tr.succeeded, 'task should succeed');
    });
});
