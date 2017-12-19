// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('XamariniOS L0 Suite', function () {
    before(() => {

    });

    after(() => {

    });

    it('XamariniOS signing with identifiers', function (done: MochaDone) {
        this.timeout(1000);

        const tp = path.join(__dirname, 'L0SignWithIds.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone ' +
            '/p:Codesignkey=testSignIdentity /p:CodesignProvision=testUUID'),
                'xbuild should have run with codesign for IDs');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS signing with files', function (done: MochaDone) {
        this.timeout(2500);

        const tp = path.join(__dirname, 'L0SignWithFiles.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone ' +
                '/p:CodesignKeychain=/user/build/_xamariniostasktmp.keychain ' +
                '/p:Codesignkey=iPhone Developer: XamariniOS Tester (HE432Y3E2Q) /p:CodesignProvision=testuuid'),
        'xbuild should have run with codesigning with files');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS skip nuget restore', function (done: MochaDone) {
        this.timeout(1000);

        const tp = path.join(__dirname, 'L0SkipNugetRestore.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(!tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should not have run');
        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
        'xbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS clean build', function (done: MochaDone) {
        this.timeout(1000);

        const tp = path.join(__dirname, 'L0CleanBuild.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean'),
        'xbuild /t:Clean should have run');
        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should have run');
        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
        'xbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS msbuild as build tool', function (done: MochaDone) {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0MSBuildDefault.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean'),
        'msbuild /t:Clean should have run');
        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should have run');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
        'msbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS msbuild as build tool with location', function (done: MochaDone) {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0MSBuildLocation.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean'),
        'msbuild /t:Clean should have run');
        assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should have run');
        assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
        'msbuild should have run');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS can find a single solution file with a glob pattern', function (done: MochaDone) {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0SingleWildcardMatch.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.warningIssues.length === 0, 'should not have issued any warnings');
        assert(tr.errorIssues.length === 0, 'should not have produced any errors');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS warns when multiple solution files match a glob pattern', function (done: MochaDone) {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0MultipleWildcardMatch.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.warningIssues.length > 0, 'should have issued a warning');
        assert(tr.errorIssues.length === 0, 'should not have produced any errors');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS fails when no solution files match a glob pattern', function (done: MochaDone) {
        this.timeout(2000);

        const tp = path.join(__dirname, 'L0NoWildcardMatch.js');
        const tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.warningIssues.length === 0, 'should not have issued any warnings');
        assert(tr.errorIssues.length > 0, 'should have produced an error');
        assert(!tr.succeeded, 'task should not have succeeded');

        done();
    });
})