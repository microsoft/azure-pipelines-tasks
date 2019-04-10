import assert = require('assert');
import path = require('path');
import * as ttm from 'vsts-task-lib/mock-test';

describe('NodeTool Suite', function () {
    this.timeout(60000);

    it('Succeeds when the first download is available', (done: MochaDone) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FirstDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'NodeTool should have succeeded.');
        assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');

        done();
    });

    it('Succeeds when the second download is available', (done: MochaDone) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SecondDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'NodeTool should have succeeded.');
        assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');

        done();
    });

    it('Succeeds when the third download is available', (done: MochaDone) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ThirdDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'NodeTool should have succeeded.');
        assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');

        done();
    });

});