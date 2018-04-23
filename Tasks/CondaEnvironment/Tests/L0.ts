import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';
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

    // TODO remove
    it('test', async function () {
        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockery.registerMock('vsts-task-tool-lib/tool', {});
        const uut = reload();
    })

    it('does not download Conda if found, creates and activates environment', async function () {
        mockery.registerMock('vsts-task-lib/task', mockTask);

        const findConda = sinon.stub().returns('findConda');
        const downloadConda = sinon.spy();
        const createEnvironment = sinon.spy();
        const activateEnvironment = sinon.spy();
        mockery.registerMock('./conda_internal', {
            findConda: findConda,
            downloadConda: downloadConda,
            createEnvironment: createEnvironment,
            activateEnvironment: activateEnvironment
        });

        const uut = reload();
        const parameters = {
            environmentName: 'env',
            installConda: true
        };

        await uut.condaEnvironment(parameters, Platform.Linux);
        assert(findConda.calledOnceWithExactly(Platform.Linux));
        assert(downloadConda.notCalled);
        assert(createEnvironment.calledOnceWithExactly('findConda', 'env', undefined, undefined));
        assert(activateEnvironment.calledOnceWithExactly('env'));
    })

    it('downloads Conda if not found, creates and activates environment', async function () {
        mockery.registerMock('vsts-task-lib/task', mockTask);

        const findConda = sinon.stub().returns(null);
        const downloadConda = sinon.stub().returns('downloadConda');
        const createEnvironment = sinon.spy();
        const activateEnvironment = sinon.spy();
        mockery.registerMock('./conda_internal', {
            findConda: findConda,
            downloadConda: downloadConda,
            createEnvironment: createEnvironment,
            activateEnvironment: activateEnvironment
        });

        const uut = reload();
        const parameters = {
            environmentName: 'env',
            installConda: true
        };

        await uut.condaEnvironment(parameters, Platform.Linux);
        assert(findConda.calledOnceWithExactly(Platform.Linux));
        assert(downloadConda.calledOnceWithExactly(Platform.Linux));
        assert(createEnvironment.calledOnceWithExactly('downloadConda', 'env', undefined, undefined));
        assert(activateEnvironment.calledOnceWithExactly('env'));
    })

    it('does not download Conda if not found and user opts not to', async function (done: MochaDone) {
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
            getVariable: (name: string) => name === 'CONDA' ? 'path/to/conda' : undefined
        }));

        const findConda = sinon.stub().returns(null);
        const downloadConda = sinon.spy();
        const createEnvironment = sinon.spy();
        const activateEnvironment = sinon.spy();
        mockery.registerMock('./conda_internal', {
            findConda: findConda,
            downloadConda: downloadConda,
            createEnvironment: createEnvironment,
            activateEnvironment: activateEnvironment
        });

        const uut = reload();
        const parameters = {
            environmentName: 'env',
            installConda: false
        };

        try {
            await uut.condaEnvironment(parameters, Platform.Windows);
            done(new Error('should not have succeeded'));
        } catch (e) {
            assert.strictEqual(e.message, 'loc_mock_CondaNotFound path/to/conda');
            assert(findConda.calledOnceWithExactly(Platform.Windows));
            assert(downloadConda.notCalled);
            assert(createEnvironment.notCalled);
            assert(activateEnvironment.notCalled);
            done();
        }
    })
});
