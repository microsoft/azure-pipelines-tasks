import * as assert from 'assert';
import * as path from 'path';

import { MockTestRunner } from 'vsts-task-lib/mock-test';

describe('PyPI Publisher', function () {
    it('Test to verify pip command arguments', function () {
        const tp = path.join(__dirname, 'L0PipCommands.js');
        const tr = new MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('twine installed successfully'));
    });

    it('Test for Python tool execution failure ', function () {
        const tp = path.join(__dirname, 'L0PythonExecFail.js');
        const tr = new MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('failed to install twine'));
    });
});
