import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';

import * as mockTask from 'azure-pipelines-task-lib/mock-task';

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

    const getVariable = sinon.stub();
    getVariable.withArgs('HOME').returns('/home');

    const setVariable = sinon.spy();

    mockery.registerMock('azure-pipelines-task-lib/task', Object.assign({}, mockTask, {
        getVariable,
        setVariable
    }));

    const findConda = sinon.stub().returns('path-to-conda');
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda,
        prependCondaToPath,
        createEnvironment,
        activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        createCustomEnvironment: true,
        environmentName: 'env',
        updateConda: false
    };

    await uut.condaEnvironment(parameters, Platform.Linux);

    const expectedEnvsDir = path.join('/home', '.conda', 'envs');
    assert(findConda.calledOnceWithExactly(Platform.Linux));
    assert(prependCondaToPath.calledOnceWithExactly('path-to-conda', Platform.Linux));
    assert(createEnvironment.calledOnceWithExactly(path.join(expectedEnvsDir, 'env'), undefined, undefined));
    assert(activateEnvironment.calledOnceWithExactly(expectedEnvsDir, 'env', Platform.Linux));
    assert(setVariable.calledOnceWithExactly('CONDA_ENVS_PATH', expectedEnvsDir));
});

it('requires `createCustomEnvironment` to be set to create a custom environment', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

    const findConda = sinon.stub().returns('path-to-conda');
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda,
        prependCondaToPath,
        createEnvironment,
        activateEnvironment
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

    mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

    const findConda = sinon.stub().returns('path-to-conda');
    const prependCondaToPath = sinon.spy();
    const updateConda = sinon.spy()
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda,
        prependCondaToPath,
        updateConda,
        createEnvironment,
        activateEnvironment
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

it('fails if `conda` is not found', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('azure-pipelines-task-lib/task', mockTask)

    const findConda = sinon.stub().returns(null);
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        findConda,
        createEnvironment,
        activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        environmentName: 'env',
        updateConda: false
    };

    // Can't use `assert.throws` with an async function
    // Node 10: use `assert.rejects`
    let error: any | undefined;
    try {
        await uut.condaEnvironment(parameters, Platform.Windows);
    } catch (e) {
        error = e;
    }

    assert(error instanceof Error);
    assert.strictEqual(error.message, 'loc_mock_CondaNotFound');

    assert(findConda.calledOnceWithExactly(Platform.Windows));
    assert(prependCondaToPath.notCalled);
    assert(createEnvironment.notCalled);
    assert(activateEnvironment.notCalled);
});

it('fails if installing packages to the base environment fails', async function () {
    mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

    const findConda = sinon.stub().returns('path-to-conda');
    const prependCondaToPath = sinon.spy();
    const installPackagesGlobally = sinon.stub().rejects(new Error('installPackagesGlobally'));

    mockery.registerMock('./conda_internal', {
        findConda,
        prependCondaToPath,
        installPackagesGlobally
    });

    const uut = reload('../conda');
    const parameters = {
        createCustomEnvironment: false,
        packageSpecs: 'pytest',
        updateConda: false
    };

    // Can't use `assert.throws` with an async function
    // Node 10: use `assert.rejects`
    let error: any | undefined;
    try {
        await uut.condaEnvironment(parameters, Platform.Linux);
    } catch (e) {
        error = e;
    }

    assert(error instanceof Error);
    assert.strictEqual(error.message, 'installPackagesGlobally');

    assert(findConda.calledOnceWithExactly(Platform.Linux));
    assert(prependCondaToPath.calledOnceWithExactly('path-to-conda', Platform.Linux));
    assert(installPackagesGlobally.calledOnceWithExactly('pytest', Platform.Linux, undefined));
});
