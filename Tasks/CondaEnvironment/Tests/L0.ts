import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as mockTask from 'vsts-task-lib/mock-task';

import { Platform } from '../taskutil';
import * as condaEnvironment from '../conda';

/** Reload the unit under test to use mocks that have been registered. */
function reload(): typeof condaEnvironment {
    return require('../conda');
}

describe('CondaEnvironment L0 Suite', function () {
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
    })

    it('test', function () {
        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockery.registerMock('vsts-task-tool-lib/tool', {});
        const uut = reload();
    })
});
