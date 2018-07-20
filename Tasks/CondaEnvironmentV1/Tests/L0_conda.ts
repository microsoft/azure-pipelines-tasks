import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';

import * as mockTask from 'vsts-task-lib/mock-task';

import { Platform } from '../taskutil';

import * as condaEnvironment from '../conda';

/** Reload the unit under test to use mocks that have been registered. */
function reload(module: '../conda'): typeof condaEnvironment {
    return require('../conda');
}

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

it('creates and activates environment', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('vsts-task-lib/task', mockTask);

    const findConda = sinon.stub().returns('path-to-conda');
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda: findConda,
        prependCondaToPath: prependCondaToPath,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        createCustomEnvironment: true,
        environmentName: 'env',
        updateConda: false
    };

    await uut.condaEnvironment(parameters, Platform.Linux);
    assert(findConda.calledOnceWithExactly(Platform.Linux));
    assert(prependCondaToPath.calledOnceWithExactly('path-to-conda', Platform.Linux));
    assert(createEnvironment.calledOnceWithExactly(path.join('path-to-conda', 'envs', 'env'), undefined, undefined));
    assert(activateEnvironment.calledOnceWithExactly(path.join('path-to-conda', 'envs'), 'env', Platform.Linux));
});

it('requires `createCustomEnvironment` to be set to create a custom environment', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('vsts-task-lib/task', mockTask);

    const findConda = sinon.stub().returns('path-to-conda');
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda: findConda,
        prependCondaToPath: prependCondaToPath,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        environmentName: 'env',
        updateConda: false
    };

    await uut.condaEnvironment(parameters, Platform.Linux);
    assert(createEnvironment.notCalled);
    assert(activateEnvironment.notCalled);
});


it('updates Conda if the user requests it', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('vsts-task-lib/task', mockTask);

    const findConda = sinon.stub().returns('path-to-conda');
    const prependCondaToPath = sinon.spy();
    const updateConda = sinon.spy()
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda: findConda,
        prependCondaToPath: prependCondaToPath,
        updateConda: updateConda,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        updateConda: true
    };

    await uut.condaEnvironment(parameters, Platform.Linux);
    assert(findConda.calledOnceWithExactly(Platform.Linux));
    assert(prependCondaToPath.calledOnceWithExactly('path-to-conda', Platform.Linux));
    assert(updateConda.calledOnceWithExactly('path-to-conda', Platform.Linux));
});

it('fails if `conda` is not found', async function (done: MochaDone) {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('vsts-task-lib/task', mockTask)

    const findConda = sinon.stub().returns(null);
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda: findConda,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        environmentName: 'env',
        updateConda: false
    };

    try {
        await uut.condaEnvironment(parameters, Platform.Windows);
        done(new Error('should not have succeeded'));
    } catch (e) {
        assert.strictEqual(e.message, 'loc_mock_CondaNotFound');
        assert(findConda.calledOnceWithExactly(Platform.Windows));
        assert(prependCondaToPath.notCalled);
        assert(createEnvironment.notCalled);
        assert(activateEnvironment.notCalled);
        done();
    }
});