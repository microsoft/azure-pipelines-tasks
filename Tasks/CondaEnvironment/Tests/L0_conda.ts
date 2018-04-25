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

it('downloads Conda if `CONDA` is not set, creates and activates environment', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    const setVariable = sinon.spy();
    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        getVariable: sinon.stub().withArgs('CONDA').returns(undefined),
        setVariable: setVariable
    }));

    const hasConda = sinon.stub().returns(false);
    const downloadMiniconda = sinon.stub().returns('path-downloadMiniconda');
    const installMiniconda = sinon.stub().returns('path-installMiniconda');
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        hasConda: hasConda,
        downloadMiniconda: downloadMiniconda,
        installMiniconda: installMiniconda,
        prependCondaToPath: prependCondaToPath,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        environmentName: 'env',
        installConda: true
    };

    await uut.condaEnvironment(parameters, Platform.Linux);
    assert(hasConda.notCalled);
    assert(downloadMiniconda.calledOnceWithExactly(Platform.Linux));
    assert(installMiniconda.calledOnceWithExactly('path-downloadMiniconda', Platform.Linux));
    assert(prependCondaToPath.calledOnceWithExactly('path-installMiniconda', Platform.Linux));
    assert(createEnvironment.calledOnceWithExactly(path.join('path-installMiniconda', 'envs', 'env'), undefined, undefined));
    assert(activateEnvironment.calledOnceWithExactly(path.join('path-installMiniconda', 'envs'), 'env', Platform.Linux));
    assert(setVariable.calledOnceWithExactly('CONDA', 'path-installMiniconda'));
});

it('downloads Conda if `conda` is not found, creates and activates environment', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    const setVariable = sinon.spy();
    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        getVariable: sinon.stub().withArgs('CONDA').returns('path-to-conda'),
        setVariable: setVariable
    }));

    const hasConda = sinon.stub().returns(false);
    const downloadMiniconda = sinon.stub().returns('path-downloadMiniconda');
    const installMiniconda = sinon.stub().returns('path-installMiniconda');
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        hasConda: hasConda,
        downloadMiniconda: downloadMiniconda,
        prependCondaToPath: prependCondaToPath,
        installMiniconda: installMiniconda,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        environmentName: 'env',
        installConda: true
    };

    await uut.condaEnvironment(parameters, Platform.Linux);
    assert(hasConda.calledOnceWithExactly('path-to-conda', Platform.Linux));
    assert(downloadMiniconda.calledOnceWithExactly(Platform.Linux));
    assert(installMiniconda.calledOnceWithExactly('path-downloadMiniconda', Platform.Linux));
    assert(prependCondaToPath.calledOnceWithExactly('path-installMiniconda', Platform.Linux));
    assert(createEnvironment.calledOnceWithExactly(path.join('path-installMiniconda', 'envs', 'env'), undefined, undefined));
    assert(activateEnvironment.calledOnceWithExactly(path.join('path-installMiniconda', 'envs'), 'env', Platform.Linux));
    assert(setVariable.calledOnceWithExactly('CONDA', 'path-installMiniconda'));
})

it('does not download Conda if found, creates and activates environment', async function () {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        getVariable: sinon.stub().withArgs('CONDA').returns('path-to-conda')
    }));

    const hasConda = sinon.stub().returns(true);
    const downloadMiniconda = sinon.spy();
    const installMiniconda = sinon.spy();
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        hasConda: hasConda,
        downloadMiniconda: downloadMiniconda,
        prependCondaToPath: prependCondaToPath,
        installMiniconda: installMiniconda,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        environmentName: 'env',
        installConda: true
    };

    await uut.condaEnvironment(parameters, Platform.Linux);
    assert(hasConda.calledOnceWithExactly('path-to-conda', Platform.Linux));
    assert(downloadMiniconda.notCalled);
    assert(prependCondaToPath.calledOnceWithExactly('path-to-conda', Platform.Linux));
    assert(createEnvironment.calledOnceWithExactly(path.join('path-to-conda', 'envs', 'env'), undefined, undefined));
    assert(activateEnvironment.calledOnceWithExactly(path.join('path-to-conda', 'envs'), 'env', Platform.Linux));
});

it('does not download Conda if not found and user opts not to', async function (done: MochaDone) {
    mockery.registerMock('fs', {
        existsSync: () => false
    });

    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        getVariable: sinon.stub().withArgs('CONDA').returns('path-to-conda')
    }));

    const hasConda = sinon.stub().returns(false);
    const downloadMiniconda = sinon.spy();
    const installMiniconda = sinon.spy();
    const prependCondaToPath = sinon.spy();
    const createEnvironment = sinon.spy();
    const activateEnvironment = sinon.spy();
    mockery.registerMock('./conda_internal', {
        hasConda: hasConda,
        downloadMiniconda: downloadMiniconda,
        installMiniconda: installMiniconda,
        createEnvironment: createEnvironment,
        activateEnvironment: activateEnvironment
    });

    const uut = reload('../conda');
    const parameters = {
        environmentName: 'env',
        installConda: false
    };

    try {
        await uut.condaEnvironment(parameters, Platform.Windows);
        done(new Error('should not have succeeded'));
    } catch (e) {
        assert.strictEqual(e.message, `loc_mock_CondaNotFound ${'path-to-conda'}`);
        assert(hasConda.calledOnceWithExactly('path-to-conda', Platform.Windows));
        assert(downloadMiniconda.notCalled);
        assert(prependCondaToPath.notCalled);
        assert(installMiniconda.notCalled);
        assert(createEnvironment.notCalled);
        assert(activateEnvironment.notCalled);
        done();
    }
});