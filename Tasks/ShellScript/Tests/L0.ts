
// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('ShellScript L0 Suite', function () {
    before(() => {

    });

    after(() => {

    });

    it('runs shellscript in cwd', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0runsInCwd.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.Run();
        assert(tr.Ran('/usr/local/bin/bash /script.sh arg1 arg2'), 'it should have run ShellScript');
        assert(tr.invokedToolCount == 1, 'should have only run ShellScript');
        assert(tr.stdout.indexOf('bash output here') >= 0, "bash stdout");
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
   
});
