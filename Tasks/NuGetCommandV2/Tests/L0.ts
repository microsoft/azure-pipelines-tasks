import * as assert from 'node:assert';
import * as path from 'node:path';

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NuGetCommand Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 60000);

    it('restore single solution', async () => {
        const tp = path.join(__dirname, './RestoreTests/singlesln.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore single solution with CredentialProvider', async () => {
        const tp = path.join(__dirname, './RestoreTests/singleslnCredentialProvider.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.stdout.indexOf('credProviderPath = ') >= 0, 'should have found credential provider path');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.warningIssues.length, 0, 'should have no warnings');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore packages.config', async () => {
        const tp = path.join(__dirname, './RestoreTests/pkgconfig.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore single solution with noCache', async () => {
        const tp = path.join(__dirname, './RestoreTests/singleslnNoCache.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NoCache -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore single solution with disableParallelProcessing', async () => {
        const tp = path.join(__dirname, './RestoreTests/singleslnDisableParallelProcessing.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -DisableParallelProcessing -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore single solution with nuget config', async () => {
        const tp = path.join(__dirname, './RestoreTests/singleslnConfigFile.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with ConfigFile specified');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore multiple solutions', async () => {
        const tp = path.join(__dirname, './RestoreTests/multiplesln.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 2, 'should have run NuGet twice');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive'), 'it should have run NuGet on single.sln');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\double\\double.sln -NonInteractive'), 'it should have run NuGet on double.sln');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore multiple solutions and parses pattern appropriately', async () => {
        const tp = path.join(__dirname, './RestoreTests/multipleslnmultiplepattern.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 2, 'should have run NuGet twice');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive'), 'it should have run NuGet on single.sln');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\double\\double.sln -NonInteractive'), 'it should have run NuGet on double.sln');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore single solution mono', async () => {
        const tp = path.join(__dirname, './RestoreTests/singleslnMono.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('/usr/bin/mono c:\\from\\tool\\installer\\nuget.exe restore ~/myagent/_work/1/s/single.sln -NonInteractive'), 'it should have run NuGet with mono');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore select vsts source', async () => {
        const tp = path.join(__dirname, './RestoreTests/selectSourceVsts.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with a vsts source');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore select nuget.org source', async () => {
        const tp = path.join(__dirname, './RestoreTests/selectSourceNuGetOrg.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with nuget.org source');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore select multiple sources', async () => {
        const tp = path.join(__dirname, './RestoreTests/selectSourceMultiple.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with multiple sources');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore select nuget.org source warns', async () => {
        const tp = path.join(__dirname, './RestoreTests/nugetOrgBehaviorWarn.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with nuget.org source');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded with issues');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore select nuget.org source fails', async () => {
        const tp = path.join(__dirname, './RestoreTests/nugetOrgBehaviorFail.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 0, 'should not run NuGet');
        assert(tr.failed, 'should have Failed');
        assert.equal(tr.errorIssues.length, 2, 'should have 2 errors');
    });

    it('restore select nuget.org source on nuget config succeeds', async () => {
        const tp = path.join(__dirname, './RestoreTests/nugetOrgBehaviorOnConfig.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with ConfigFile specified');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('pushes successfully to internal feed using NuGet.exe', async () => {
        const tp = path.join(__dirname, './PublishTests/internalFeedNuGet.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe push c:\\agent\\home\\directory\\foo.nupkg -NonInteractive -Source https://vsts/packagesource -ApiKey VSTS'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('pushes successfully to internal feed using VstsNuGetPush.exe', async () => {
        const tp = path.join(__dirname, './PublishTests/internalFeedVstsNuGetPush.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run VstsNuGetPush once');
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\VstsNuGetPush.exe c:\\agent\\home\\directory\\foo.nupkg -Source https://vsts/packagesource -AccessToken token -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('VstsNuGetPush output here'), 'should have VstsNuGetPush output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('pushes successfully to internal project scoped feed using VstsNuGetPush.exe', async () => {
        const tp = path.join(__dirname, './PublishTests/internalFeedVstsNuGetPushProjectScoped.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run VstsNuGetPush once');
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\VstsNuGetPush.exe c:\\agent\\home\\directory\\foo.nupkg -Source https://vsts/ProjectId/packagesource -AccessToken token -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('VstsNuGetPush output here'), 'should have VstsNuGetPush output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('succeeds when conflict occurs using VstsNuGetPush.exe (allow conflict)', async () => {
        const tp = path.join(__dirname, './PublishTests/internalFeedVstsNuGetPushAllowConflict.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run VstsNuGetPush once');
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\VstsNuGetPush.exe c:\\agent\\home\\directory\\foo.nupkg -Source https://vsts/packagesource -AccessToken token -NonInteractive'), 'it should have run VstsNuGetPush');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('VstsNuGetPush output here'), 'should have VstsNuGetPush output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('succeeds when conflict occurs using NuGet.exe on Linux (allow conflict)', async () => {
        const tp = path.join(__dirname, './PublishTests/failWithContinueOnConflictOnLinux.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet.exe once');
        assert(tr.stdErrContained, 'stderr output is here');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('fails when conflict occurs using VstsNuGetPush.exe (disallow conflict)', async () => {
        const tp = path.join(__dirname, './PublishTests/internalFeedVstsNuGetPushDisallowConflict.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run VstsNuGetPush once');
        assert(tr.ran('c:\\agent\\home\\directory\\externals\\nuget\\VstsNuGetPush.exe c:\\agent\\home\\directory\\foo.nupkg -Source https://vsts/packagesource -AccessToken token -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('VstsNuGetPush output here'), 'should have VstsNuGetPush output');
        assert(tr.failed, 'should have failed');
    });

    it('packs with prerelease', async () => {
        const tp = path.join(__dirname, './PackTests/packPrerelease.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe pack c:\\agent\\home\\directory\\foo.nuspec -NonInteractive -OutputDirectory C:\\out\\dir -version x.y.z-CI-22220101-010101'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('packs with env var', async () => {
        const tp = path.join(__dirname, './PackTests/packEnvVar.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe pack c:\\agent\\home\\directory\\foo.nuspec -NonInteractive -OutputDirectory C:\\out\\dir -version XX.YY.ZZ'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('packs with build number', async () => {
        const tp = path.join(__dirname, './PackTests/packBuildNumber.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe pack c:\\agent\\home\\directory\\foo.nuspec -NonInteractive -OutputDirectory C:\\out\\dir -version 1.2.3'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('packs with base path', async () => {
        const tp = path.join(__dirname, './PackTests/packBasePath.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe pack c:\\agent\\home\\directory\\foo.nuspec -NonInteractive -OutputDirectory C:\\out\\dir -BasePath C:\\src'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('packs tool', async () => {
        const tp = path.join(__dirname, './PackTests/packTool.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe pack c:\\agent\\home\\directory\\foo.nuspec -NonInteractive -OutputDirectory C:\\out\\dir -Tool'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('works with custom command happy path', async () => {
        const tp = path.join(__dirname, './CustomCommandTests/customHappyPath.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe these are my arguments -NonInteractive'), 'it should have run NuGet');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore single solution with nuget config and multiple service connections', async () => {
        const tp = path.join(__dirname, './RestoreTests/multipleServiceConnections.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config'), 'it should have run NuGet with ConfigFile specified');
        assert(tr.stdOutContained('setting console code page'), 'it should have run chcp');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint1.visualstudio.com/path'), 'it should have added auth entry for endpoint 1');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint2.visualstudio.com/path'), 'it should have added auth entry for endpoint 2');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });


    it('custom command fails when exit code !=0', async () => {
        const tp = path.join(__dirname, './CustomCommandTests/customFailPath.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdErrContained, 'stderr output is here');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, 'should have 1 error');
        assert.equal(tr.errorIssues[0], 'loc_mock_Error_NugetFailedWithCodeAndErr 1 stderr output is here', 'should have error from nuget');
    });

    it('pack fails when exit code !=0', async () => {
        const tp = path.join(__dirname, './PackTests/packFails.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdErrContained, 'stderr output is here');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 2, 'should have 1 error from nuget and one from task');
        assert.equal(tr.errorIssues[0], 'loc_mock_Error_NugetFailedWithCodeAndErr 1 stderr output is here', 'should have error from nuget');
        assert.equal(tr.errorIssues[1], 'loc_mock_Error_PackageFailure', 'should have error from task runner');
    });

    it('publish fails when duplicates are skipped and exit code!=[0|2] on Windows_NT', async () => {
        const tp = path.join(__dirname, './PublishTests/failWithContinueOnConflict.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdErrContained, 'stderr output is here');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 2, 'should have 1 error from nuget and one from task');
        assert.equal(tr.errorIssues[0], 'Error: loc_mock_Error_UnexpectedErrorVstsNuGetPush 1 stderr output is here', 'should have error from nuget');
        assert.equal(tr.errorIssues[1], 'loc_mock_PackagesFailedToPublish', 'should have error from task runner');
    });

    it('publish fails when duplicates are NOT skipped and exit code!=0', async () => {
        const tp = path.join(__dirname, './PublishTests/failWithoutContinueOnConflict.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdErrContained, 'stderr output is here');
        assert(tr.failed, 'should have failed');
    });

    it('restore fails when exit code!=0', async () => {
        const tp = path.join(__dirname, './RestoreTests/failRestore.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdErrContained, 'stderr output is here');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 2, 'should have 1 error from nuget and one from task');
        assert.equal(tr.errorIssues[0], 'loc_mock_Error_NugetFailedWithCodeAndErr 1 stderr output is here', 'should have error from nuget');
        assert.equal(tr.errorIssues[1], 'loc_mock_PackagesFailedToInstall', 'should have error from task runner');
    });

    it('restore succeeds on ubuntu 22', async () => {
        const tp = path.join(__dirname, './RestoreTests/singleslnUbuntu22.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('/usr/bin/mono c:\\from\\tool\\installer\\nuget.exe restore ~/myagent/_work/1/s/single.sln -NonInteractive'), 'it should have run NuGet with mono');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore succeeds on ubuntu 24 with mono', async () => {
        const tp = path.join(__dirname, './RestoreTests/singleslnUbuntu24Mono.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run NuGet once');
        assert(tr.ran('/usr/bin/mono c:\\from\\tool\\installer\\nuget.exe restore ~/myagent/_work/1/s/single.sln -NonInteractive'), 'it should have run NuGet with mono');
        assert(tr.stdOutContained('NuGet output here'), 'should have nuget output');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('restore fails on ubuntu 24 without mono', async () => {
        const tp = path.join(__dirname, './RestoreTests/failUbuntu24NoMono.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, 'should have 1 error');
        assert(tr.invokedToolCount == 0, 'should have run no tools');
    });
});