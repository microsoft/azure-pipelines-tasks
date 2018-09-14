import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as path from 'path';

describe('PyPI Publisher', function () {

    it('Test to verify pip command arguments', function () {
        let tp = path.join(__dirname, 'L0PipCommands.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('twine installed successfully'));
    });

    it('Test for Python tool execution failure ', function () {
        let tp = path.join(__dirname, 'L0PythonExecFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdErrContained('failed to install twine'));
    });
});
