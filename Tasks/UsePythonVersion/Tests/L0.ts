import * as assert from 'assert';
import * as path from 'path';

// import * as mockery from 'mockery';
import { MockTestRunner } from 'vsts-task-lib/mock-test';

import { Platform } from '../taskutil';

describe('UsePythonVersion L0 Suite', function () {
    // before(function () {
    //     mockery.enable({
    //         useCleanCache: true,
    //         warnOnUnregistered: false
    //     });
    // });
    
    // after(function () {
    //     mockery.disable();
    // });

    // afterEach(function () {
    //     mockery.deregisterAll();
    //     mockery.resetCache();
    // });

    describe('usepythonversion.ts', function () {
        require('./L0_usepythonversion');
    });

    it('succeeds when version is found', function () {
        const testFile = path.join(__dirname, 'L0SucceedsWhenVersionIsFound.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
    });

    it('fails when version is not found', function () {

    });
});
