import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DotNetCoreExe Suite', function () {
    this.timeout(10000);
    before(() => {
        process.env['SYSTEM_DEBUG'] = 'true';
    });

    after(function () {
    });

    it('fails if the dotnet tool is not found', async () => {
        let tp = path.join(__dirname, 'dotnetExeNotFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, "error reason should have been recorded");
    });

    it('restore fails when zero match found', async () => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "restore";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
    });

    it('restore passes when zero match found with empty string', async () => {
        process.env["__projects__"] = "";
        process.env["__command__"] = "restore";
        let tp = path.join(__dirname, './RestoreTests/emptyProjectField.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('restore single solution', async () => {
        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('restore nocache', async () => {
        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__nocache__"] = "true";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --no-cache'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output, no-cache'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__nocache__"] = undefined;
    });

    it('restore verbosity Detailed', async () => {
        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__verbosity__"] = "Detailed";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --verbosity Detailed'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output, verbosity Detailed'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__verbosity__"] = undefined;
    });

    it('restore verbosity - omits switch', async () => {
        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__verbosity__"] = "-";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__verbosity__"] = undefined;
    });

    it('restore with config file', async () => {
        let tp = path.join(__dirname, './RestoreTests/singleProjectConfigFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('restore with packages directory', async () => {
        let tp = path.join(__dirname, './RestoreTests/packagesDirectory.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --packages path\\to\\packages --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('restore with vsts feed', async () => {
        let tp = path.join(__dirname, './RestoreTests/selectSourceVsts.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://vsts/packagesource'), 'it should have added vsts source to config');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('Using project scope 98320bea-3915-4ef2-9333-908d3290289c'), "should have used project scope");
        assert(tr.stdOutContained("Using feed registry url"), "should have used feed url, not session url");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('restore select nuget.org source', async () => {
        let tp = path.join(__dirname, './RestoreTests/selectSourceNuGetOrg.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://api.nuget.org/v3/index.json'), "should have added nuget.org source to config");
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('restore single solution with nuget config and multiple service connections', async () => {
        let tp = path.join(__dirname, './RestoreTests/multipleServiceConnections.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet with ConfigFile specified');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint1.visualstudio.com/path'), 'it should have added auth entry for endpoint 1');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint2.visualstudio.com/path'), 'it should have added auth entry for endpoint 2');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('restore select nuget.org source warns', async () => {
        let tp = path.join(__dirname, './RestoreTests/nugetOrgBehaviorWarn.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://api.nuget.org/v3/index.json'), "should have added nuget.org source to config");
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded with issues');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('restore select nuget.org source fails', async () => {
        let tp = path.join(__dirname, './RestoreTests/nugetOrgBehaviorFail.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 0, 'should not run dotnet once');
        assert(tr.failed, 'should have Failed');
        assert.equal(tr.errorIssues.length, 2, "should have 2 errors");
    });

    it('restore select nuget.org source on nuget config succeeds', async () => {
        let tp = path.join(__dirname, './RestoreTests/nugetOrgBehaviorOnConfig.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('build fails when zero match found', async () => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "build";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
    });

    it('build passes when zero match found with empty string', async () => {
        process.env["__projects__"] = "";
        process.env["__command__"] = "build";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('test throws warning when zero match found', async () => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "test";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.warningIssues && tr.warningIssues.length, 'Should have thrown a warning in the stream');
    });

    it('publish works with explicit project files setting modifyoutput to false', async () => {

        process.env["__projects__"] = '*customoutput/project.json';
        process.env["__arguments__"] = "--configuration release --output /usr/out";
        process.env["modifyOutput"] = "false";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool');
        assert(tr.stdOutContained("published web3 without adding project name to path"), "shouldn't have appended the project name");
        assert(tr.stdOutContained("published lib2 without adding project name to path"), "shouldn't have appended the project name");
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('publish works with explicit project files', async () => {

        process.env["__projects__"] = '**/project.json';
        process.env["modifyOutput"] = "true";
        process.env["__arguments__"] = " ";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 4, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('publish works with no project file is specified', async () => {

        process.env["__projects__"] = "";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have suceeded');

    });

    it('publish fails with when the dotnet publish fails', async () => {

        process.env["__projects__"] = "dummy/project.json";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.failed, 'task should have failed');
    });

    it('publish fails with error when the project file pattern return zero match', async () => {
        process.env["__projects__"] = "*fail*/project.json"
        process.env["__publishWebProjects__"] = "false";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues && tr.errorIssues.length, "No error was reported for this issue.");
    });


    it('publish works with publishWebProjects option', async () => {

        process.env["__projects__"] = "";
        process.env["__publishWebProjects__"] = "true";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked been invoked once');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('publish does not use logger when feature flag is disabled', async () => {
        let tp = path.join(__dirname, 'publishWithFeatureFlagDisabled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('dotnet publish web/project.csproj'), 'should have run dotnet publish');
        // Verify that the logger argument is NOT present
        assert(!tr.ran(/.*-dl:CentralLogger.*/), 'should NOT have logger argument when feature flag is disabled');
        assert(tr.stdOutContained('published without logger'), 'should have published without logger');
    });


    it('publish works with publishWebProjects option if .csproj have Microsoft.Net.Sdk.Web', async () => {
        process.env["__projects__"] = "validateWebProject.csproj";
        process.env["workingDirectory"] = ".";
        process.env["__publishWebProject__"] = "true";
        let tp = path.join(__dirname, 'validateWebProject.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked been invoked once');
        assert(tr.succeeded, 'task should have succeeded');
    })

    it('publish updates the output with the project name appended', async () => {
        process.env["__projects__"] = "*customoutput/project.json";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('publish works with zipAfterPublish option', () => {
        // TODO
    });

    it('publish fails with zipAfterPublish and publishWebProjects option with no project file specified', async () => {
        process.env["__projects__"] = "";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        // TODO: Add Zip
        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('packs with prerelease', async () => {
        let tp = path.join(__dirname, './PackTests/packPrerelease.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack -p:NuspecFile=c:\\agent\\home\\directory\\foo.nuspec --output C:\\out\\dir /p:PackageVersion=x.y.z-CI-YYYYMMDD-HHMMSS'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('packs with env var', async () => {
        let tp = path.join(__dirname, './PackTests/packEnvVar.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack -p:NuspecFile=c:\\agent\\home\\directory\\foo.nuspec --output C:\\out\\dir /p:PackageVersion=XX.YY.ZZ'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('packs with build number', async () => {
        let tp = path.join(__dirname, './PackTests/packBuildNumber.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\single.csproj --output C:\\out\\dir /p:PackageVersion=1.2.3'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('pack fails no files are found', async () => {
        let tp = path.join(__dirname, './PackTests/noProjectsFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 0, 'should not have run dotnet');
        assert(tr.failed, 'should have fai;ed');
        assert.equal(tr.errorIssues.length, 1, "should have thrown an error");
    });

    it('pushes successfully to internal hosted feed', async () => {
        let tp = path.join(__dirname, './PushTests/internalFeed.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe nuget push c:\\agent\\home\\directory\\foo.nupkg --source https://vsts/packagesource --api-key VSTS'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained("Using project scope ProjectId"), "should have used project scope");
        assert(tr.stdOutContained("Using session registry url"), "should have set up a session");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('push fails when projects are not found', async () => {
        let tp = path.join(__dirname, './PushTests/noProjectsFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 0, 'should not have run dotnet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have thrown an error");
    });

    it('test command with publish test results should call trx logger and publish test results', async () => {
        let tp = path.join(__dirname, './TestCommandTests/publishtests.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('test command with publish test results directory containing spaces should call trx logger and publish test results', async () => {
        let tp = path.join(__dirname, './TestCommandTests/publishtestsWithSpaceDir.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent new\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent new\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent new\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('test command with publish test results should call trx logger and publish test results without build props', async () => {
        const tp = path.join(__dirname, './TestCommandTests/publishtestsWithoutBuildConfig.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('test command with publish test results should call trx logger and publish test results with failed dotnet test', async () => {
        const tp = path.join(__dirname, './TestCommandTests/publishtestsWithFailedTestCommand.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet error'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.failed, 'should have failed');
    });

    it('test command without publish test results', async () => {
        const tp = path.join(__dirname, './TestCommandTests/runTestsWithoutPublish.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount === 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), 'should have dotnet output');
        assert(!tr.stdOutContained('vso[results.publish'), 'it shouldnt contain publish command');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
    });

    it('custom command fails when no project match found', async () => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "test";
        process.env["__projects__"] = "*nomatch*/project.json";

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have thrown an error");
    });

    it('custom command executes without projects if none supplied', async () => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "vstest";
        process.env["__projects__"] = "";
        process.env["__arguments__"] = "supplied/in/arguments.dll --framework netcoreapp2.0"

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.ran('c:\\path\\dotnet.exe vstest supplied/in/arguments.dll --framework netcoreapp2.0'), 'it should have run dotnet with expected arguments');
        assert(tr.stdOutContained('vstest succeeded'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });

    it('custom command fails if dotnet returns error', async () => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "test";
        process.env["__projects__"] = "fails/project.json";
        process.env["__arguments__"] = "--no-build --no-restore"

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.ran('c:\\path\\dotnet.exe test fails/project.json --no-build --no-restore'), 'it should have run dotnet with expected arguments');
        assert(tr.stdOutContained('test failed'), "should have dotnet output");
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, "error reason should have been recorded");
    });

    it('custom command runs once for each matched project', async () => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "test";
        process.env["__projects__"] = "**/project.json";
        process.env["__arguments__"] = ""

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 4, 'should not have invoked tool 4 times');
        assert(tr.succeeded, 'task should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
    });
});
