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
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore single solution with CredentialProvider', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnCredentialProvider.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.stdout.indexOf('Got auth token') >= 0, "should have got Auth token");
        assert(tr.stdout.indexOf('credProviderPath = ') >= 0, "should have found credential provider path");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
    
    it('restore packages.config', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'pkgconfig.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });   
    
    it('restore single solution with noCache', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnNoCache.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NoCache -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
    
    it('restore single solution with nuget config', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnConfigFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with ConfigFile specified');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained("adding package source uri: mockFeedUri"), "should have added content to temp config");
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore multiple solutions', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'multiplesln.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 2, 'should have run NuGet twice');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive'), 'it should have run NuGet on single.sln');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\double\\double.sln -NonInteractive'), 'it should have run NuGet on double.sln');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
    
    it('restore single solution mono', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnMono.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('/usr/bin/mono c:\\from\\tool\\installer\\nuget.exe restore ~/myagent/_work/1/s/single.sln -NonInteractive'), 'it should have run NuGet with mono');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore select vsts source', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'selectSourceVsts.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with a vsts source');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

        it('restore select nuget.org source', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'selectSourceNuGetOrg.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with nuget.org source');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore select multiple sources', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'selectSourceMultiple.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with multiple sources');
        assert(tr.stdOutContained('NuGet output here'), "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
});