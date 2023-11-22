import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as path from 'path';
import assert = require('assert');

describe('NotationV0 Suite', function () {
    it('install notation', async function () {
        this.timeout(10000);

        let tp = path.join(__dirname, 'L0Install.js');
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()

        assert(tr.succeeded, 'should have succeeded');
    })

    it('notation sign', async function () {
        this.timeout(10000);

        let tp = path.join(__dirname, 'L0Sign.js');
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()

        assert(tr.succeeded, 'should have succeeded');
    })

    it('notation verify', async function () {
        this.timeout(10000);

        let tp = path.join(__dirname, 'L0Verify.js');
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()

        assert(tr.succeeded, 'should have succeeded');
    })
})