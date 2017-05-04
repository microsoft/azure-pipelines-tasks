import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('XamarinAndroid L0 Suite', function () {
    before(() => {

    });

    after(() => {

    });

    it('XamarinAndroid uses msbuild 15 on macOS', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0UseMSbuild15OnMac.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/home/bin/msbuild /user/build/fun/test.csproj /t:PackageForAndroid'),
            'msbuild should have run');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
})