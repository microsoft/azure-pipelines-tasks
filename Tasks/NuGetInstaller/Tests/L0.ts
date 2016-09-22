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
        assert(tr.ran('c:\\foo\\system32\\chcp.com 65001'), 'it should have run chcp');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore single solution with CredentialProvider', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnCredentialProvider.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln'), 'it should have run NuGet');
        assert(tr.ran('c:\\foo\\system32\\chcp.com 65001'), 'it should have run chcp');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.stdout.indexOf('Got auth token') >= 0, "should have got Auth token");
        assert(tr.stdout.indexOf('credProviderPath = c:\agent\home\directory\externals\nuget') >= 0, "should have found credential provider path");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
    
    it('restore packages.config', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'pkgconfig.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\packages.config'), 'it should have run NuGet');
        assert(tr.ran('c:\\foo\\system32\\chcp.com 65001'), 'it should have run chcp');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });   
    
    it('restore single solution with noCache', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnNoCache.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln -NoCache'), 'it should have run NuGet');
        assert(tr.ran('c:\\foo\\system32\\chcp.com 65001'), 'it should have run chcp');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 2, 'should have run NuGet and chcp');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
    
    it('restore single solution with nuget config', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnConfigFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with ConfigFile specified');
        assert(tr.ran('c:\\foo\\system32\\chcp.com 65001'), 'it should have run chcp');
        assert(tr.stdout.indexOf('getting package sources') >= 0, "should have read package sources from nuget");
        assert(tr.stdout.indexOf('setting package sources') >= 0, "should have set package sources in temp nuget");
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
    
    it('restore single solution mono', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'singleslnMono.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.ran('/usr/bin/mono ~/myagent/_work/_tasks/NuGet/nuget.exe restore -NonInteractive ~/myagent/_work/1/s/single.sln'), 'it should have run NuGet with mono');
        assert(tr.stdout.indexOf('NuGet output here') >= 0, "should have nuget output");
        assert(tr.succeeded, 'should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have run NuGet');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
});