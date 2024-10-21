// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('XamariniOS L0 Suite', function () {
    it('run XamariniOSV2 with all default inputs', async function () {
        this.timeout(10000);

        const tp = path.join(__dirname, 'L0DefaultInputs.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'it should have run nuget restore');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'), 'it should have run msbuild');
        assert(tr.invokedToolCount === 3, 'should have only run 3 commands');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('XamariniOS signing with identifiers', async function () {
        this.timeout(4000);

        const tp = path.join(__dirname, 'L0SignWithIds.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone ' +
            '/p:Codesignkey=testSignIdentity /p:CodesignProvision=testUUID'),
            'msbuild should have run with codesign for IDs');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('XamariniOS skip nuget restore', async function () {
        this.timeout(4000);

        const tp = path.join(__dirname, 'L0SkipNugetRestore.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(!tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should not have run');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
            'msbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('XamariniOS clean build', async function () {
        this.timeout(4000);

        const tp = path.join(__dirname, 'L0CleanBuild.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean'),
            'msbuild /t:Clean should have run');
        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should have run');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
            'msbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('XamariniOS msbuild as build tool', async function () {
        this.timeout(4000);

        const tp = path.join(__dirname, 'L0MSBuildDefault.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean'),
            'msbuild /t:Clean should have run');
        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should have run');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
            'msbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('XamariniOS msbuild as build tool with location', async function () {
        this.timeout(4000);

        const tp = path.join(__dirname, 'L0MSBuildLocation.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean'),
            'msbuild /t:Clean should have run');
        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should have run');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
            'msbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('XamariniOS can find a single solution file with a glob pattern', async function () {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0OneWildcardMatch.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.warningIssues.length === 0, 'should not have issued any warnings');
        assert(tr.errorIssues.length === 0, 'should not have produced any errors');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'));
    });

    it('XamariniOS warns when multiple solution files match a glob pattern', async function () {
        this.timeout(4000);

        const tp = path.join(__dirname, 'L0MultipleWildcardMatch.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.warningIssues.length > 0, 'should have issued a warning');
        assert(tr.warningIssues[0] === 'loc_mock_MultipleSolutionsFound src/1.sln');
        assert(tr.errorIssues.length === 0, 'should not have produced any errors');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('/home/bin/msbuild src/1.sln /p:Configuration=Release /p:Platform=iPhone'));
    });

    it('XamariniOS fails when no solution files match a glob pattern', async function () {
        this.timeout(4000);

        const tp = path.join(__dirname, 'L0NoWildcardMatch.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.warningIssues.length === 0, 'should not have issued any warnings');
        assert(tr.errorIssues.length > 0, 'should have produced an error');
        assert(tr.errorIssues[0] === 'loc_mock_XamariniOSFailed Error: loc_mock_SolutionDoesNotExist **/*.sln');
        assert(!tr.succeeded, 'task should not have succeeded');
    });

    it('XamariniOS fallback to xbuild when msbuild is not found', async function () {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0FallbackXbuild.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
            'xbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('XamariniOS task fails on Windows', async function () {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0RunOnWindows.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues[0] === 'loc_mock_XamariniOSFailed Error: loc_mock_BuildRequiresMac');
    })

    it('run XamariniOSV2 with buildToolLocation set', async function () {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0BuildToolLocation.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'it should have run nuget restore');
        assert(tr.ran('/home/bin2/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'), 'it should have run msbuild');
        assert(tr.invokedToolCount === 2, 'should have only run 2 commands');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    })

    it('fails when solution is missing', async function () {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0MissingSolution.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not have run XamariniOS');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues[0].indexOf('Input required: solution') >= 0, 'wrong error message');
    })

    it('fails when configuration is missing', async function () {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MissingConfig.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not have run XamariniOS');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues[0].indexOf('Input required: configuration') >= 0, 'wrong error message');
    })

    it('fails when msbuildLocation not provided and msbuild is not found', async function () {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0ToolsNotFound.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not have run XamariniOS');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues[0].indexOf('loc_mock_XamariniOSFailed loc_mock_MSB_BuildToolNotFound') >= 0, 'wrong error message');
    });

    it('fails when msbuildLocation is provided but is incorrect', async function () {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MSBuildNotFound.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not have run XamariniOS');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues[0].indexOf('Error: Not found /user/bin/') >= 0, 'wrong error message');
    });

    // fails when nuget not found
    it('fails when nuget not found', async function () {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0NuGetNotFound.js');
        const tr = new ttm.MockTestRunner(tp);

        await tr.runAsync()

        assert(tr.invokedToolCount === 0, 'should not have run XamariniOS');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues[0].indexOf('Not found null') >= 0, 'wrong error message');
    });
})
