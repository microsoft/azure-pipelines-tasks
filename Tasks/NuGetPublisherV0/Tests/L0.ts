import * as path from 'path';
import * as assert from 'assert';

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NuGetPublisher Suite', function () {
    it('publish single package internally', async () => {
        const tp = path.join(__dirname, 'internal.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe push -NonInteractive c:\\agent\\home\\directory\\package.nupkg -Source testFeedUri -ApiKey VSTS -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'should have pushed packages');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have run NuGet');
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    }).timeout(20000);

    it('publish single package externally', async () => {
        const tp = path.join(__dirname, 'external.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe push -NonInteractive c:\\agent\\home\\directory\\package.nupkg -Source https://example.feed.com -ApiKey secret'), 'should have pushed packages');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(!tr.stdOutContained('adding package source uri'), "should not set package source in config");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have run NuGet');
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    }).timeout(20000);
});