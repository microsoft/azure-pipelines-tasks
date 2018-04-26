import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';

import * as mockTask from 'vsts-task-lib/mock-task';
import * as mockToolRunner from 'vsts-task-lib/mock-toolrunner';

import { Platform } from '../taskutil';

import * as condaInternal from '../conda_internal';

function reload(module: '../conda_internal'): typeof condaInternal {
    return require('../conda_internal');
}

it('finds the Conda executable with the CONDA variable', async function () {
    const existsSync = sinon.stub();
    const statSync = sinon.stub();

    mockery.registerMock('fs', {
        existsSync: existsSync,
        statSync: statSync
    });

    mockTask.setAnswers({
        which: {
        }
    });

    const getVariable = sinon.stub();
    getVariable.withArgs('CONDA').returns('path-to-conda');
    getVariable.withArgs('Agent.ToolsDirectory').returns('path-to-tools');

    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        getVariable: getVariable
    }));

    mockery.registerMock('vsts-task-tool-lib/tool', {});

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

it('downloads Miniconda', async function () {
    const getVariable = sinon.stub();
    getVariable.withArgs('Agent.TempDirectory').returns('path-temp');

    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        getVariable: getVariable
    }));

    const downloadTool = sinon.stub().returns('path-downloadTool');
    mockery.registerMock('vsts-task-tool-lib/tool', {
        downloadTool: downloadTool
    });

    const uut = reload('../conda_internal');

    { // Linux
        const actual = await uut.downloadMiniconda(Platform.Linux);
        assert(downloadTool.calledOnceWithExactly('https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh', path.join('path-temp', 'Miniconda3-latest-Linux-x86_64.sh')));
    }
    { // macOS
        downloadTool.resetHistory();
        const actual = await uut.downloadMiniconda(Platform.MacOS);
        assert(downloadTool.calledOnceWithExactly('https://repo.continuum.io/miniconda/Miniconda3-latest-MacOSX-x86_64.sh', path.join('path-temp', 'Miniconda3-latest-MacOSX-x86_64.sh')));
    }
    { // Windows
        downloadTool.resetHistory();
        const actual = await uut.downloadMiniconda(Platform.Windows);
        assert(downloadTool.calledOnceWithExactly('https://repo.continuum.io/miniconda/Miniconda3-latest-Windows-x86_64.exe', path.join('path-temp', 'Miniconda3-latest-Windows-x86_64.exe')));
    }
});

it('installs Miniconda', async function (done: MochaDone) {
    const getVariable = sinon.stub();
    getVariable.withArgs('Agent.ToolsDirectory').returns('path-to-tools');

    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        getVariable: getVariable
    }));

    mockery.registerMock('vsts-task-tool-lib/tool', {});
    mockery.registerMock('vsts-task-lib/toolrunner', mockToolRunner);
    const uut = reload('../conda_internal');

    { // Linux
        mockToolRunner.setAnswers({
            exec: {
                'bash installer.sh -b -f -p path-to-tools/Miniconda/latest': {
                    code: 0
                },
                // workaround for running tests cross-platform
                'bash installer.sh -b -f -p path-to-tools\\Miniconda\\latest': {
                    code: 0
                }
            }
        });

        const actual = await uut.installMiniconda('installer.sh', Platform.Linux);
        assert.strictEqual(actual, path.join('path-to-tools', 'Miniconda', 'latest'));
    }
    { // macOS
        mockToolRunner.setAnswers({
            exec: {
                'bash installer.sh -b -f -p path-to-tools/Miniconda/latest': {
                    code: 0
                },
                // workaround for running tests cross-platform
                'bash installer.sh -b -f -p path-to-tools\\Miniconda\\latest': {
                    code: 0
                }
            }
        });

        const actual = await uut.installMiniconda('installer.sh', Platform.MacOS);
        assert.strictEqual(actual, path.join('path-to-tools', 'Miniconda', 'latest'));
    }
    { // Windows
        mockToolRunner.setAnswers({
            exec: {
                'installer.exe /S /AddToPath=0 /RegisterPython=0 /D=path-to-tools\\Miniconda\\latest': {
                    code: 0
                },
                // workaround for running tests cross-platform
                'installer.exe /S /AddToPath=0 /RegisterPython=0 /D=path-to-tools/Miniconda/latest': {
                    code: 0
                }
            }
        });

        const actual = await uut.installMiniconda('installer.exe', Platform.Windows);
        assert.strictEqual(actual, path.join('path-to-tools', 'Miniconda', 'latest'));
    }
    { // Failed installation
        mockToolRunner.setAnswers({
            exec: {
                'bash installer.sh -b -f -p path-to-tools/Miniconda/latest': {
                    code: 1
                },
                // workaround for running tests cross-platform
                'bash installer.sh -b -f -p path-to-tools\\Miniconda\\latest': {
                    code: 1
                }
            }
        });

        try {
            const actual = await uut.installMiniconda('installer.sh', Platform.MacOS);
            done(new Error('should not have succeeded'));
        } catch (e) {
            assert.strictEqual(e.message, `loc_mock_InstallationFailed Error: bash failed with return code: 1`);
            done();
        }
    }
});

it('creates Conda environment', async function (done: MochaDone) {
    mockery.registerMock('vsts-task-lib/task', mockTask);
    mockery.registerMock('vsts-task-lib/toolrunner', mockToolRunner);
    mockery.registerMock('vsts-task-tool-lib/tool', {});
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
            done(new Error('should not have succeeded'));
        } catch (e) {
            assert.strictEqual(e.message, `loc_mock_CreateFailed ${path.join('envsDir', 'env')} Error: conda failed with return code: 1`);
            done();
        }
    }
});

it('activates Conda environment', async function () {
    const setVariable = sinon.spy();
    mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
        setVariable: setVariable
    }));

    const prependPath = sinon.spy();
    mockery.registerMock('vsts-task-tool-lib/tool', {
        prependPath: prependPath
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