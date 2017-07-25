import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'vsts-task-lib/mock-test';

import os = require('os');
import fs = require('fs');

describe('DotNetCoreExe Suite', function () {
    before(() => {
    });

    after(function () {
    });

    it('fails if the dotnet tool is not found', (done: MochaDone) => {
        let tp = path.join(__dirname, 'dotnetExeNotFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, "error reason should have been recorded");
        done();
    });

    it('restore fails when zero match found', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "restore";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('restore passes when zero match found with empty string', (done: MochaDone) => {
        process.env["__projects__"] = "";
        process.env["__command__"] = "restore";
        let tp = path.join(__dirname, './RestoreTests/emptyProjectField.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('restore single solution', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore nocache', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__nocache__"] = "true";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --no-cache'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output, no-cache'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__nocache__"] = undefined;
        done();
    });

    it('restore verbosity Detailed', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__verbosity__"] = "Detailed";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --verbosity Detailed'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output, verbosity Detailed'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__verbosity__"] = undefined;
        done();
    });

    it('restore verbosity - omits switch', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__verbosity__"] = "-";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__verbosity__"] = undefined;
        done();
    });

    it('restore with config file', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProjectConfigFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore with vsts feed', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/selectSourceVsts.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://vsts/packagesource'), 'it should have added vsts source to config');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore select nuget.org source', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/selectSourceNuGetOrg.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://api.nuget.org/v3/index.json'), "should have added nuget.org source to config");
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore single solution with nuget config and multiple service connections', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/multipleServiceConnections.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet with ConfigFile specified');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint1.visualstudio.com/path'), 'it should have added auth entry for endpoint 1');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint2.visualstudio.com/path'), 'it should have added auth entry for endpoint 2');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('build fails when zero match found', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "build";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        done();
    });
    
    it('build passes when zero match found with empty string', (done: MochaDone) => {
        process.env["__projects__"] = "";
        process.env["__command__"] = "build";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });
    
    it('test throws warning when zero match found', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "test";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.warningIssues && tr.warningIssues.length, 'Should have thrown a warning in the stream');
        done();
    });

    it('publish works with explicit project files', (done: MochaDone) => {

        process.env["__projects__"] = '**/project.json';
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('publish works with no project file is specified', (done: MochaDone) => {

        process.env["__projects__"] = "";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have suceeded');

        done();
    });

    it('publish fails with when the dotnet publish fails', (done: MochaDone) => {

        process.env["__projects__"] = "dummy/project.json";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('publish fails with error when the project file pattern return zero match', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json"
        process.env["__publishWebProjects__"] = "false";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues && tr.errorIssues.length, "No error was reported for this issue.");
        done();
    });


    it('publish works with publishWebProjects option', (done: MochaDone) => {

        process.env["__projects__"] = "";
        process.env["__publishWebProjects__"] = "true";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked been invoked once');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('publish updates the output with the project name appended', (done: MochaDone) => {
        process.env["__projects__"] = "*customoutput/project.json";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('publish works with zipAfterPublish option', (done: MochaDone) => {
        // TODO
        done();
    });

    it('publish fails with zipAfterPublish and publishWebProjects option with no project file specified', (done: MochaDone) => {
        process.env["__projects__"] = "";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        // TODO: Add Zip
        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('packs with prerelease', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PackTests/packPrerelease.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\foo.nuspec --output C:\\out\\dir /p:PackageVersion=x.y.z-CI-YYYYMMDD-HHMMSS'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('packs with env var', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PackTests/packEnvVar.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\foo.nuspec --output C:\\out\\dir /p:PackageVersion=XX.YY.ZZ'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('packs with build number', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PackTests/packBuildNumber.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\single.csproj --output C:\\out\\dir /p:PackageVersion=1.2.3'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('pushes successfully to internal hosted feed', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PushTests/internalFeed.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe nuget push c:\\agent\\home\\directory\\foo.nupkg --source https://vsts/packagesource --api-key VSTS'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('pushes successfully to internal onprem feed, does not set auth in config', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PushTests/internalFeedOnPrem.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe nuget push c:\\agent\\home\\directory\\foo.nupkg --source https://vsts/packagesource --api-key VSTS'), 'it should have run dotnet');
        assert(tr.stdOutContained('Push to internal OnPrem server detected. Credential configuration will be skipped.'), "should detect internal onprem push");
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

});