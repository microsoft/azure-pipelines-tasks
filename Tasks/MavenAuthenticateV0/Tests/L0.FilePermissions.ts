import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import * as mavenutils from '../mavenutils';
import { TestConstants, TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - File Permissions', function () {
    const mutableFs: any = require('fs');
    const mutableTaskLib: any = require('azure-pipelines-task-lib/task');
    const settingsPath = path.join('testhome', '.m2', 'settings.xml');
    const settingsDirectory = path.dirname(settingsPath);
    let originalOsType: typeof tl.osType;
    let originalMkdirSync: typeof fs.mkdirSync;
    let originalWriteFile: typeof fs.writeFile;
    let originalChmodSync: typeof fs.chmodSync;

    beforeEach(function () {
        originalOsType = tl.osType;
        originalMkdirSync = fs.mkdirSync;
        originalWriteFile = fs.writeFile;
        originalChmodSync = fs.chmodSync;
    });

    afterEach(function () {
        mutableTaskLib.osType = originalOsType;
        mutableFs.mkdirSync = originalMkdirSync;
        mutableFs.writeFile = originalWriteFile;
        mutableFs.chmodSync = originalChmodSync;
    });

    it('should create the Maven directory and settings file with restricted permissions on non-Windows agents', async () => {
        const mkdirCalls: any[][] = [];
        const chmodCalls: any[][] = [];
        let writeOptions: any;

        mutableTaskLib.osType = () => 'Linux';
        mutableFs.mkdirSync = ((...args: any[]) => {
            mkdirCalls.push(args);
        }) as typeof fs.mkdirSync;
        mutableFs.chmodSync = ((...args: any[]) => {
            chmodCalls.push(args);
        }) as typeof fs.chmodSync;
        mutableFs.writeFile = ((file: fs.PathOrFileDescriptor, data: any, options: fs.WriteFileOptions, callback: fs.NoParamCallback) => {
            writeOptions = options;
            callback(null);
        }) as typeof fs.writeFile;

        await mavenutils.jsonToXmlConverter(settingsPath, { settings: {} });

        assert.deepStrictEqual(mkdirCalls, [[settingsDirectory, { recursive: true, mode: 0o700 }]]);
        assert.strictEqual(writeOptions.mode, 0o600);
        assert.deepStrictEqual(chmodCalls, [[settingsPath, 0o600]]);
    });

    it('should preserve existing Windows permission behavior', async () => {
        const mkdirCalls: any[][] = [];
        const chmodCalls: any[][] = [];
        let writeOptions: any;

        mutableTaskLib.osType = () => 'Windows_NT';
        mutableFs.mkdirSync = ((...args: any[]) => {
            mkdirCalls.push(args);
        }) as typeof fs.mkdirSync;
        mutableFs.chmodSync = ((...args: any[]) => {
            chmodCalls.push(args);
        }) as typeof fs.chmodSync;
        mutableFs.writeFile = ((file: fs.PathOrFileDescriptor, data: any, options: fs.WriteFileOptions, callback: fs.NoParamCallback) => {
            writeOptions = options;
            callback(null);
        }) as typeof fs.writeFile;

        await mavenutils.jsonToXmlConverter(settingsPath, { settings: {} });

        assert.deepStrictEqual(mkdirCalls, [[settingsDirectory, { recursive: true }]]);
        assert.strictEqual(writeOptions.mode, undefined);
        assert.deepStrictEqual(chmodCalls, []);
    });

    it('should restrict a newly created Maven directory on non-Windows agents', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'false';
        process.env[TestEnvVars.settingsXmlExists] = 'false';
        process.env[TestEnvVars.osType] = 'Linux';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'chmodSync');
        TestHelpers.assertOutputContains(tr, '.m2 700');
    });

    it('should preserve an existing Maven directory and restrict existing settings files', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'true';
        process.env[TestEnvVars.settingsXmlContent] = TestConstants.sampleSettingsXml.withOtherFeed;
        process.env[TestEnvVars.settingsXmlMode] = '640';
        process.env[TestEnvVars.osType] = 'Linux';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'settings.xml 600');
        TestHelpers.assertOutputContains(tr, '_settings.xml 600');
        TestHelpers.assertOutputDoesNotContain(tr, '.m2 700');
    });

    it('should not fail the task when chmodSync throws on unsupported filesystems', async () => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'false';
        process.env[TestEnvVars.settingsXmlExists] = 'false';
        process.env[TestEnvVars.osType] = 'Linux';
        process.env[TestEnvVars.chmodShouldFail] = 'true';

        try {
            await tr.runAsync();
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'Unable to set restrictive permissions');
        } finally {
            delete process.env[TestEnvVars.chmodShouldFail];
        }
    });
});
