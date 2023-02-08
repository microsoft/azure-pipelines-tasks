import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NuGet Task Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('Happy path', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'happypath.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe testCommand -NonInteractive testArgument'), 'NuGet was not run with the expected parameters');
        assert(tr.stdOutContained('setting console code page'), 'It should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "The NuGet output was not found on stdOut");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
});