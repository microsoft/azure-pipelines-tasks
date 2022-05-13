import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { Done } from 'mocha';
import * as utilsTests from './L0UtilsTests';

describe('CopyFilesOverSSHV0 Suite', function () {
    before(() => {
    });

    after(() => {
    });
   
    it('Completes simple copying scenario successfully', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SimpleScenario.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'Task should have succeeded.');
        assert(tr.stderr.length === 0, 'Task should not have written to stderr');

        done();
    });

    it('Prints target folder creation error', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0TargetFolderCreationError.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'Task should have succeeded.');
        assert(
            tr.stdout.indexOf("##vso[task.issue type=error;]loc_mock_FailedOnFile c:\\sourceFolder\\file1.txt loc_mock_TargetNotCreated ./fakeTargetFolder Failure during ./fakeTargetFolder folder creation") >= 0,
            "There should be error message about failed target folder creation"
        );

        done();
    });


    utilsTests.run();
});
