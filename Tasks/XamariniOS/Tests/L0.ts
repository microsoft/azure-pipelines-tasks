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

    it('XamariniOS signing with identifiers', (done:MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0SignWithIds.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone ' +
            '/p:Codesignkey=testSignIdentity /p:CodesignProvision=testUUID'),
                'xbuild should have run with codesign for IDs');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS signing with files', (done:MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0SignWithFiles.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone ' +
                '/p:CodesignKeychain=/user/build/_xamariniostasktmp.keychain ' +
                '/p:Codesignkey=iPhone Developer: XamariniOS Tester (HE432Y3E2Q) /p:CodesignProvision=testuuid'),
        'xbuild should have run with codesigning with files');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('XamariniOS skip nuget restore', (done:MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0SkipNugetRestore.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(!tr.ran('/home/bin/nuget restore src/project.sln'), 'nuget restore should not have run');
        assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'),
        'xbuild should have run');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

});