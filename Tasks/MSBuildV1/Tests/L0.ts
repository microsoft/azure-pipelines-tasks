import assert = require('assert');
import path = require('path');
import * as ttm from 'vsts-task-lib/mock-test';
var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('MSBuild Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before((done) => {
        if (psm.testSupported()) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(function () {
        if (psr) {
            psr.kill();
        }
    });

    if (psm.testSupported()) {
        it('passes arguments', (done) => {
            psr.run(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
    }

    it('Xplat MSBuild: Defaults', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0MSBuildDefaults.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        //build
        assert(tr.ran('/home/bin/xbuild /user/build/fun.sln /p:Platform=$(Platform) /p:Configuration=$(Configuration)'),
            'xbuild should have been run for building the solution.');

        assert(tr.invokedToolCount === 1, 'should have run xbuild for solution.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xplat MSBuild: Clean and Build', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0MSBuildClean.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        //clean
        assert(tr.ran('/home/bin/xbuild /user/build/fun.sln /t:Clean /p:Platform=$(Platform) /p:Configuration=$(Configuration) ' +
            '/p:TestProp=TestValue /p:TestProp1=TestValue'), 'xbuild clean should have been run on the solution.');

        //build
        assert(tr.ran('/home/bin/xbuild /user/build/fun.sln /p:Platform=$(Platform) /p:Configuration=$(Configuration) ' +
            '/p:TestProp=TestValue /p:TestProp1=TestValue'), 'xbuild should have been run for building the solution.');

        assert(tr.invokedToolCount === 2, 'should have run xbuild for solution.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xplat MSBuild: Multiple solutions', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0MSBuildMultipleSolutions.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        //clean
        assert(tr.ran('/home/bin/xbuild /user/build/fun.sln /t:Clean /p:Platform=$(Platform) /p:Configuration=$(Configuration) ' +
            '/p:TestProp=TestValue /p:TestProp1=TestValue'), 'xbuild clean should have been run on the solution.');

        assert(tr.ran('/home/bin/xbuild /user/build/test/fun.sln /t:Clean /p:Platform=$(Platform) /p:Configuration=$(Configuration) ' +
            '/p:TestProp=TestValue /p:TestProp1=TestValue'), 'xbuild clean should have been run on the solution.');

        //build
        assert(tr.ran('/home/bin/xbuild /user/build/fun.sln /p:Platform=$(Platform) /p:Configuration=$(Configuration) ' +
            '/p:TestProp=TestValue /p:TestProp1=TestValue'), 'xbuild should have been run for building the solution.');

        assert(tr.ran('/home/bin/xbuild /user/build/test/fun.sln /p:Platform=$(Platform) /p:Configuration=$(Configuration) ' +
            '/p:TestProp=TestValue /p:TestProp1=TestValue'), 'xbuild should have been run for building the solution.');

        assert(tr.invokedToolCount === 4, 'should have run xbuild for solution.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});