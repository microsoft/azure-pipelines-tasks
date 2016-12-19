
// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('VSMobileCenterUpload L0 Suite', function () {
    before(() => {
        //Enable this for output
        //process.env['TASK_TEST_TRACE'] = 1; 

        //setup endpoint
        process.env["ENDPOINT_AUTH_MyTestEndpoint"] = "{\"parameters\":{\"apitoken\":\"mytoken123\"},\"scheme\":\"apitoken\"}";
        process.env["ENDPOINT_URL_MyTestEndpoint"] = "https://example.test/v0.1";
        process.env["ENDPOINT_AUTH_PARAMETER_MyTestEndpoint_APITOKEN"] = "mytoken123";
    });

    after(() => {

    });

    it('Positive path: upload one ipa file', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0OneIpaPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Negative path: can not upload multiple files', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0MultipleIpaFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('Negative path: mobile center api rejects fail the task', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0ApiRejectsFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');

        done()
    })
});
