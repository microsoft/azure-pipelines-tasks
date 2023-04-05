
// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as fs from 'fs'
import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { utilsUnitTests } from './L0UtilsUnitTests';
import { spawnSync } from 'child_process';

describe('AppCenterDistribute L0 Suite', function () {

    const finalPath = path.join(__dirname, "../../../../Tests/test.ipa");
    const finalPath2 = path.join(__dirname, "../../../../Tests/test2.ipa");
    const apkPath = path.join(__dirname, "../../../../Tests/test.apk");
    const appxPath = path.join(__dirname, "../../../../Tests/test.appxbundle");
    const zipPath = path.join(__dirname, "../../../../Tests/test.zip");
    const defaultTimeout = 6000;

    before(() => {

        fs.writeFileSync(finalPath, "fileContent");
        fs.writeFileSync(finalPath2, "fileContent");
        fs.writeFileSync(apkPath, "fileContent");
        fs.writeFileSync(appxPath, "fileContent");
        fs.writeFileSync(zipPath, "fileContent");
        //Enable this for output
        //process.env['TASK_TEST_TRACE'] = '1';

        //clean env variables
        delete process.env['BUILD_BUILDID'];
        delete process.env['BUILD_SOURCEBRANCH'];
        delete process.env['BUILD_SOURCEVERSION'];
        delete process.env['LASTCOMMITMESSAGE'];

        //setup endpoint
        process.env["ENDPOINT_AUTH_MyTestEndpoint"] = "{\"parameters\":{\"apitoken\":\"mytoken123\"},\"scheme\":\"apitoken\"}";
        process.env["ENDPOINT_URL_MyTestEndpoint"] = "https://example.test/v0.1";
        process.env["ENDPOINT_AUTH_PARAMETER_MyTestEndpoint_APITOKEN"] = "mytoken123";
        process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"]="/agent/1/_work";
    });

    after(() => {
        delete process.env['BUILD_BUILDID'];
        delete process.env['BUILD_SOURCEBRANCH'];
        delete process.env['BUILD_SOURCEVERSION'];
        delete process.env['LASTCOMMITMESSAGE'];
        fs.unlinkSync(finalPath);
        fs.unlinkSync(finalPath2);
        fs.unlinkSync(appxPath);
        fs.unlinkSync(apkPath);
        fs.unlinkSync(zipPath);
    });

    it('Positive path: upload one ipa file', function () {
        this.timeout(7000);
        let tp = path.join(__dirname, 'L0OneIpaPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Negative path: can not upload multiple files', function () {
        this.timeout(4000);

        let tp = path.join(__dirname, 'L0MultipleIpaFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Negative path: cannot continue upload without symbols', function () {
        this.timeout(7000);

        let tp = path.join(__dirname, 'L0NoSymbolsFails.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Positive path: can continue upload without symbols if variable VSMobileCenterUpload.ContinueIfSymbolsNotFound is true', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0NoSymbolsConditionallyPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Negative path: mobile center api rejects fail the task', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0ApiRejectsFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Negative path: publish multiple stores destinations fail the task', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0PublishMultipleStoresFails.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Negative path: publish stores without destintation fail the task', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0PublishNoStoresFails.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Positive path: publish single store destination', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0PublishStore.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish single store destination and ignores isSilent property', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0PublishStoreIgnoreSilent.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: single file with Include Parent', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0SymIncludeParent.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: multiple dSYMs in the same folder', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_flat_1.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: multiple dSYMs in parallel folders', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_flat_2.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: multiple dSYMs in a tree', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_tree.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: a single dSYM', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_single.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: a single APPXSYM', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0SymAPPXSYMs_single.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info (including commit message)', function () {
        this.timeout(8000);

        let tp = path.join(__dirname, 'L0PublishCommitInfo_1.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info (excluding commit message)', function () {
        this.timeout(8000);

        let tp = path.join(__dirname, 'L0PublishCommitInfo_2.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info for feature branch', function () {
        this.timeout(7000);

        let tp = path.join(__dirname, 'L0PublishCommitInfo_3.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info for tfvc branch', function () {
        this.timeout(7000);

        let tp = path.join(__dirname, 'L0PublishCommitInfo_4.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish mandatory update', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0PublishMandatoryUpdate.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish silent update', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0PublishSilentUpdate.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish multiple destinations', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0PublishMultipleDestinations.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: upload Android mapping txt to diagnostics', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0AndroidMappingTxtProvided.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    // TODO (hangs)
    it.skip('Negative path: upload zip file fails without build version', function () {
        this.timeout(12000);

        let tp = path.join(__dirname, 'L0PublishZipNoBuildVersionFails.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Positive path: upload without build version don\'t change the body', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0EmptyBuildVersionDoesntAppearInBody.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: upload with build version updates the body and leads to successfull upload', function () {
        this.timeout(defaultTimeout);

        let tp = path.join(__dirname, 'L0BuildVersionSpecifiedInBodyLeadToSuccessfulUpload.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: upload Breakpad .so files always packs them to .zip', function () {
        this.timeout(defaultTimeout);

        const tp = path.join(__dirname, 'L0SymDistributeBreakpad.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });
    
    it('Positive path: upload both Breakpad .so files and Proguard mapping.txt', function () {
        this.timeout(defaultTimeout);

        const tp = path.join(__dirname, 'L0SymDistributeBreakpadWithProguard.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    describe("Unit tests", function() {
        it('Negative path: should keep exit code', function() {
            const tp = path.join(__dirname, 'UnitTests', 'UnitTestsExitCodeIsKept.js');
            const spawn = spawnSync('node', [tp], {timeout: 2000});
            assert.equal(spawn.status, 1);
        });

        utilsUnitTests();
    });
});
