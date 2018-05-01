import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import { MockTestRunner } from 'vsts-task-lib/mock-test';

import { Platform } from '../taskutil';

describe('UsePythonVersion L0 Suite', function () {
    before(function () {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });
    
    after(function () {
        mockery.disable();
    });
    
    afterEach(function () {
        mockery.deregisterAll();
        mockery.resetCache();
    });

    describe('usepythonversion.ts', function () {
        require('./L0_usepythonversion');
    });

    it('succeeds when version is found', function () {

    });

    it('fails when version is not found', function () {

    });
});
