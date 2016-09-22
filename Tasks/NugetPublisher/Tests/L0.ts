import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('NuGetPublisher Suite', function () {
    before(() => {
    });

    after(() => {
    });
    it('publish single package internally', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'internal.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe push -NonInteractive c:\\agent\\home\\directory\\package.nupkg -Source testFeedUri -ApiKey VSTS -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'should have pushed packages');
        assert(tr.ran('c:\\foo\\system32\\chcp.com 65001'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');       
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
    
    it('publish single package externally', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'external.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe push -NonInteractive c:\\agent\\home\\directory\\package.nupkg -Source https://example.feed.com -ApiKey secret'), 'should have pushed packages');
        assert(tr.ran('c:\\foo\\system32\\chcp.com 65001'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(!tr.stdOutContained('adding package source uri'), "should not set package source in config");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
});