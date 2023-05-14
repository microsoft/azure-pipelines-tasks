import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';

import * as mockTask from 'azure-pipelines-task-lib/mock-task';
import * as mockToolRunner from 'azure-pipelines-task-lib/mock-toolrunner';

import { Platform } from '../taskutil';

import * as condaInternal from '../conda_internal';

function reload(module: '../conda_internal'): typeof condaInternal {
    return require('../conda_internal');
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

it('finds the Conda installation with the CONDA variable', function () {
    const existsSync = sinon.stub();
    const statSync = sinon.stub();

    mockery.registerMock('fs', {
        existsSync,
        statSync
    });

    mockTask.setAnswers({
        which: {
        }
    });

    const getVariable = sinon.stub();
    getVariable.withArgs('CONDA').returns('path-to-conda');
    getVariable.withArgs('Agent.ToolsDirectory').returns('path-to-tools');

    mockery.registerMock('azure-pipelines-task-lib/task', Object.assign({}, mockTask, {
        getVariable
    }));

    mockery.registerMock('azure-pipelines-tool-lib/tool', {});

    { // executable exists and is a file
        existsSync.returns(true);
        statSync.returns({
            isFile: () => true
        });

        const uut = reload('../conda_internal');

        assert.strictEqual(uut.findConda(Platform.Linux), 'path-to-conda');
        assert.strictEqual(uut.findConda(Platform.MacOS), 'path-to-conda');
        assert.strictEqual(uut.findConda(Platform.Windows), 'path-to-conda');
    }
    { // `conda` executable does not exist
        existsSync.returns(false);
        const uut = reload('../conda_internal');

        assert.strictEqual(uut.findConda(Platform.Linux), null);
        assert.strictEqual(uut.findConda(Platform.MacOS), null);
        assert.strictEqual(uut.findConda(Platform.Windows), null);
    }
    { // `conda` exists but is not a file
        existsSync.returns(true);
        statSync.returns({
            isFile: () => false
        });

        const uut = reload('../conda_internal');

        assert.strictEqual(uut.findConda(Platform.Linux), null);
        assert.strictEqual(uut.findConda(Platform.MacOS), null);
        assert.strictEqual(uut.findConda(Platform.Windows), null);
    }
});

it('finds the Conda installation with PATH', function () {
    const existsSync = sinon.stub().returns(true);
    const statSync = sinon.stub().returns({
        isFile: () => true
    });

    mockery.registerMock('fs', {
        existsSync,
        statSync
    });

    mockTask.setAnswers({
        which: {
            'conda': 'path-to-conda/bin/conda'
        }
    });

    const getVariable = sinon.stub();
    getVariable.withArgs('CONDA').returns(undefined);
    getVariable.withArgs('Agent.ToolsDirectory').returns('path-to-tools');

    mockery.registerMock('azure-pipelines-task-lib/task', Object.assign({}, mockTask, {
        getVariable
    }));

    mockery.registerMock('azure-pipelines-tool-lib/tool', {});

    const uut = reload('../conda_internal');

    assert.strictEqual(uut.findConda(Platform.Linux), 'path-to-conda');
    assert.strictEqual(uut.findConda(Platform.MacOS), 'path-to-conda');
    assert.strictEqual(uut.findConda(Platform.Windows), 'path-to-conda');
});

it('creates Conda environment', async function () {
    mockery.registerMock('azure-pipelines-task-lib/task', mockTask);
    mockery.registerMock('azure-pipelines-task-lib/toolrunner', mockToolRunner);
    mockery.registerMock('azure-pipelines-tool-lib/tool', {});
    const uut = reload('../conda_internal');

    { // success
        mockToolRunner.setAnswers({
            exec: {
                'conda create --quiet --prefix envsDir/env --mkdir --yes': {
                    code: 0
                },
                // workaround for running tests cross-platform
                'conda create --quiet --prefix envsDir\\env --mkdir --yes': {
                    code: 0
                }
            }
        });

        await uut.createEnvironment(path.join('envsDir', 'env'));
    }
    { // failure
        mockToolRunner.setAnswers({
            exec: {
                'conda create --quiet --prefix envsDir/env --mkdir --yes': {
                    code: 1
                },
                // workaround for running tests cross-platform
                'conda create --quiet --prefix envsDir\\env --mkdir --yes': {
                    code: 1
                }
            }
        });

        try {
            await uut.createEnvironment(path.join('envsDir', 'env'));
            throw new Error('should not have succeeded');
        } catch (e) {
            assert.strictEqual(e.message, `loc_mock_CreateFailed ${path.join('envsDir', 'env')} Error: conda failed with return code: 1`);
        }
    }
});

it('activates Conda environment', function () {
    const setVariable = sinon.spy();
    mockery.registerMock('azure-pipelines-task-lib/task', Object.assign({}, mockTask, {
        setVariable
    }));

    const prependPath = sinon.spy();
    mockery.registerMock('azure-pipelines-tool-lib/tool', {
        prependPath
    });

    const uut = reload('../conda_internal');

    { // Linux
        uut.activateEnvironment('envs', 'env', Platform.Linux);
        assert(prependPath.calledOnceWithExactly(path.join('envs', 'env', 'bin')));
        assert(setVariable.calledTwice);
        assert(setVariable.calledWithExactly('CONDA_DEFAULT_ENV', 'env'));
        assert(setVariable.calledWithExactly('CONDA_PREFIX', path.join('envs', 'env')));
    }
    { // macOS
        setVariable.resetHistory();
        prependPath.resetHistory();
        uut.activateEnvironment('envs', 'env', Platform.MacOS);
        assert(prependPath.calledOnceWithExactly(path.join('envs', 'env', 'bin')));
        assert(setVariable.calledTwice);
        assert(setVariable.calledWithExactly('CONDA_DEFAULT_ENV', 'env'));
        assert(setVariable.calledWithExactly('CONDA_PREFIX', path.join('envs', 'env')));
    }
    { // Windows
        setVariable.resetHistory();
        prependPath.resetHistory();
        uut.activateEnvironment('envs', 'env', Platform.Windows);
        assert(prependPath.calledWithExactly(path.join('envs', 'env')));
        assert(prependPath.calledWithExactly(path.join('envs', 'env', 'Scripts')));
        assert(setVariable.calledTwice);
        assert(setVariable.calledWithExactly('CONDA_DEFAULT_ENV', 'env'));
        assert(setVariable.calledWithExactly('CONDA_PREFIX', path.join('envs', 'env')));
    }
});