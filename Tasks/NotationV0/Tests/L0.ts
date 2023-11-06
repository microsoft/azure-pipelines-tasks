import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import assert = require('assert');

describe('NotationV0 Suite', function () {
    it('install notation', function () {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0Install.js');
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.succeeded, 'should have succeeded');
    })

    it('notation sign', function () {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0Sign.js');
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.succeeded, 'should have succeeded');
    })

    it('notation verify', function () {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0Verify.js');
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.succeeded, 'should have succeeded');
    })
})