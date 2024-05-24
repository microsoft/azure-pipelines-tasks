import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NuGetInstaller Suite', function () {
    before(() => {
    });

    after(() => {
    });
    it('restore single solution', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'singlesln.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should not have run NuGet');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);

    it('restore single solution with CredentialProvider', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'singleslnCredentialProvider.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should not have run NuGet');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.stdout.indexOf('credProviderPath = ') < 0, "should not have found credential provider path");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);
    
    it('restore packages.config', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'pkgconfig.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\packages.config'), 'it should not have run NuGet');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);   
    
    it('restore single solution with noCache', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'singleslnNoCache.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln -NoCache'), 'it should not have run NuGet');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);
	
    it('restore single solution with extra args', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'singleslnExtraArgs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln -Foo'), 'it should not have run NuGet');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);
    
    it('restore single solution with nuget config', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnConfigFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should not have run NuGet with ConfigFile specified');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained("adding package source uri: mockFeedUri"), "should not have added content to temp config");
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);

    it('restore single solution, custom NuGet path, hosted', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'singleslnCustomPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(!tr.ran('c:\\custompath\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should not have run NuGet');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);

    it('restore multiple solutions', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'multiplesln.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should not have run NuGet on single.sln');
        assert(!tr.ran('c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\double\\double.sln'), 'it should not have run NuGet on double.sln');
        assert(!tr.stdOutContained('setting console code page'), 'it should not have run chcp');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);
    
    it('restore single solution mono', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'singleslnMono.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(!tr.ran('/usr/bin/mono ~/myagent/_work/_tasks/NuGet/nuget.exe restore -NonInteractive ~/myagent/_work/1/s/single.sln'), 'it should not have run NuGet with mono');
        assert(!tr.stdOutContained('NuGet output here'), "should not have nuget output");
        assert(tr.invokedToolCount == 0, 'should not have run NuGet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);
});