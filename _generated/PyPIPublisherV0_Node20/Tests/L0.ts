import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as path from 'path';

describe('PyPI Publisher', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 8000);

    it('Test to verify pip command arguements', async function() {
        let tp = path.join(__dirname, 'L0PipCommands.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        //console.log(tr.stderr, tr.stdout);
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('twine installed successfully'));
        assert(tr.stdOutContained('distribution files created successfully'));
        assert(tr.stdOutContained('distribution files uploaded successfully'));
    });

    it('Test for Python tool execution failure ', async function() {
        let tp = path.join(__dirname, 'L0PythonExecFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        //console.log(tr.stderr, tr.stdout);
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('twine installed failed'));
    });
});
