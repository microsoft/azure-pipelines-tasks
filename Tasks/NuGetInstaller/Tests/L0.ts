import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('NuGetInstaller Suite', function () {
    before(() => {
    });

    after(() => {
    });
    it('restore single solution', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singlesln.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should have run NuGet');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore single solution, custom NuGet path, hosted', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnCustomPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.ran('c:\\custompath\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should have run NuGet');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore multiple solutions', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'multiplesln.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should have run NuGet on single.sln');
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\double\\double.sln'), 'it should have run NuGet on double.sln');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 3, 'should have run NuGet twice and chcp');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
});