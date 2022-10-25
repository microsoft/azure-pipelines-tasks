
// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AppCenterDistribute L0 Suite', function () {
    const timeout = 10000;

    before(() => {
        //Enable this for output
        //process.env['TASK_TEST_TRACE'] = '1';

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
    });

    it('Positive path: upload one ipa file', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0OneIpaPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Negative path: can not upload multiple files', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0MultipleIpaFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Negative path: cannot continue upload without symbols', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0NoSymbolsFails.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Negative path: failed when HTTP status is not 2xx', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0FailsHttpStatusNot2xx.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Postiive path: can continue upload without symbols if variable VSMobileCenterUpload.ContinueIfSymbolsNotFound is true', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0NoSymbolsConditionallyPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Negative path: mobile center api rejects fail the task', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0ApiRejectsFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.failed, 'task should have failed');
    });

    it('Positive path: single file with Include Parent', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0SymIncludeParent.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: multiple dSYMs in the same folder', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_flat_1.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: multiple dSYMs in parallel folders', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_flat_2.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: multiple dSYMs in a tree', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_tree.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: a single dSYM', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0SymMultipleDSYMs_single.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: a single PDB', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0SymPDBs_single.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: multiple PDBs', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0SymPDBs_multiple.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info (including commit message)', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0PublishCommitInfo_1.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info (excluding commit message)', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0PublishCommitInfo_2.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info for feature branch', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0PublishCommitInfo_3.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish commit info for tfvc branch', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0PublishCommitInfo_4.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Positive path: publish mandatory update', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0PublishMandatoryUpdate.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });
    
    it('Positive path: publish multiple destinations', function () {
        this.timeout(timeout);
        let tp = path.join(__dirname, 'L0PublishMultipleDestinations.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
    });
});
