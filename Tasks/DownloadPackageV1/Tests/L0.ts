import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as tl from "vsts-task-lib/task";
import * as ttm from 'vsts-task-lib/mock-test';

const outputDir = path.join(__dirname, "out");

describe('Download single file package suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before(() => {
        fs.mkdir(outputDir);
    });

    after(() => {
        tl.rmRF(outputDir);
    });

    it('downloads nuget file as zip and extracts it', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0DownloadSingleFilePackage.js');

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});