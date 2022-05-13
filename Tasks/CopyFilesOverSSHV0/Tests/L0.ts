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
        console.info(tr.stderr);
        console.info(tr.stdout);
        assert(tr.succeeded, 'Task should have succeeded.');
        assert(tr.stderr.length === 0, 'Task should not have written to stderr');

        done();
    });

    it('Prints target folder creation error', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0TargetFolderCreationError.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

       /* runValidations(() => {
            assert(tr.succeeded, 'Cmd should have succeeded.');
            assert(tr.stderr.length === 0, 'Cmd should not have written to stderr');
            assert(tr.stdout.indexOf('my script output') > 0, 'Cmd should have correctly run the script');
        }, tr, done);*/
        done();
    });


    utilsTests.run();
});
