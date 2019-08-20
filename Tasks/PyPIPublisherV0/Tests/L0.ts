import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as path from 'path';

describe('PyPI Publisher', function () {

    it('Test to verify pip command arguements', (done: MochaDone) => {
        let tp = path.join(__dirname, 'L0PipCommands.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //console.log(tr.stderr, tr.stdout);
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('twine installed successfully'));
        assert(tr.stdOutContained('distribution files created successfully'));
        assert(tr.stdOutContained('distribution files uploaded successfully'));
        done();
    });

    it('Test for Python tool execution failure ', (done: MochaDone) => {
        let tp = path.join(__dirname, 'L0PythonExecFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //console.log(tr.stderr, tr.stdout);
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('twine installed failed'));
        done();
    });
});
