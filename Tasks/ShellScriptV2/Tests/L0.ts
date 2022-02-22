
// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('ShellScript L0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 200000);
    before(() => {

    });

    after(() => {

    });

    it('runs shellscript in cwd', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0runsInCwd.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.ran('/usr/local/bin/bash /script.sh arg1 arg2'), 'it should have run ShellScript');
        assert(tr.invokedToolCount == 1, 'should have only run ShellScript');
        assert(tr.stdout.indexOf('bash output here') >= 0, "bash stdout");
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

	it('fails if script returns 1', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0failIfReturns1.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

		tr.run();
        assert(tr.ran('/usr/local/bin/bash /script.sh arg1 arg2'), 'it should have run ShellScript');
        assert(tr.invokedToolCount == 1, 'should have only run ShellScript');

        var expectedErr = '/usr/local/bin/bash failed with return code: 1';

        assert(tr.stdOutContained(expectedErr), 'should have said: ' + expectedErr);
        // failOnStdErr not set
        assert(!tr.stderr, 'should not have written to stderr');
        assert(tr.failed, 'task should have failed');
        done();
	})

	it('fails if failOnStdErr and script writes to stderr', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0failIfStdErr.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

		tr.run();
        assert(tr.ran('/usr/local/bin/bash /script.sh arg1 arg2'), 'it should have run ShellScript');
        assert(tr.invokedToolCount == 1, 'should have only run ShellScript');
        // failOnStdErr true
        assert(tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
        done();
	})

	it('fails if cwd not set', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0failNoCwd.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

		tr.run();

        assert(tr.invokedToolCount == 0, 'should not have run ShellScript');
        assert(tr.failed, 'task should have failed');
        done();
	})

	it('fails if script not found', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0failIfScriptNotFound.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

		tr.run();

        assert(tr.invokedToolCount == 0, 'should not have run ShellScript');
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('Not found /notexistscript.sh'));
        done();
	})        
});
