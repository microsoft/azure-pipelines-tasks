import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'vsts-task-lib/mock-test';

describe('Download single file package suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before(() => {
    });

    after(() => {
    });

    it('downloads nuget file as zip and extracts it', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0DownloadSingleFilePackage.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        console.log(tr.stdout);
        
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});