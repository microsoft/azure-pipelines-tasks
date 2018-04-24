import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';

import * as mockTask from 'vsts-task-lib/mock-task';
import * as mockToolRunner from 'vsts-task-lib/mock-toolrunner';

import { Platform } from '../taskutil';
import * as condaEnvironment from '../conda';
import * as condaInternal from '../conda_internal';

/** Reload the unit under test to use mocks that have been registered. */
function reload(module: '../conda'): typeof condaEnvironment;
function reload(module: '../conda_internal'): typeof condaInternal;
function reload(module: any): any {
    switch (module) {
        case '../conda': return require('../conda');
        case '../conda_internal': return require('../conda_internal');
    }
}

/** Convenience function for making an absolute path. */
// TODO just mock `path.join` everywhere?
function absPath(x: string): string {
    return path.join('/', x);
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
        const uut = reload('../conda');
    })

    // Test conda.ts

    it('downloads Conda if `CONDA` is not set, creates and activates environment', async function () {
        const setVariable = sinon.spy();
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
            getVariable: sinon.stub().withArgs('CONDA').returns(undefined),
            setVariable: setVariable
        }));

        const hasConda = sinon.stub().returns(false);
        const downloadMiniconda = sinon.stub().returns(absPath('downloadMiniconda'));
        const installMiniconda = sinon.stub().returns(absPath('installMiniconda'));
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
        assert(installMiniconda.calledOnceWithExactly(absPath('downloadMiniconda'), Platform.Linux));
        assert(prependCondaToPath.calledOnceWithExactly(absPath('installMiniconda'), Platform.Linux));
        assert(createEnvironment.calledOnceWithExactly(path.join(absPath('installMiniconda'), 'envs'), 'env', undefined, undefined));
        assert(activateEnvironment.calledOnceWithExactly(path.join(absPath('installMiniconda'), 'envs'), 'env'));
        assert(setVariable.calledOnceWithExactly('CONDA', absPath('installMiniconda')));
    })

    it('downloads Conda if `conda` is not found, creates and activates environment', async function () {
        const setVariable = sinon.spy();
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
            getVariable: sinon.stub().withArgs('CONDA').returns(absPath('path-to-conda')),
            setVariable: setVariable
        }));

        const hasConda = sinon.stub().returns(false);
        const downloadMiniconda = sinon.stub().returns(absPath('downloadMiniconda'));
        const installMiniconda = sinon.stub().returns(absPath('installMiniconda'));
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
        assert(hasConda.calledOnceWithExactly(absPath('path-to-conda'), Platform.Linux));
        assert(downloadMiniconda.calledOnceWithExactly(Platform.Linux));
        assert(installMiniconda.calledOnceWithExactly(absPath('downloadMiniconda'), Platform.Linux));
        assert(prependCondaToPath.calledOnceWithExactly(absPath('installMiniconda'), Platform.Linux));
        assert(createEnvironment.calledOnceWithExactly(path.join(absPath('installMiniconda'), 'envs'), 'env', undefined, undefined));
        assert(activateEnvironment.calledOnceWithExactly(path.join(absPath('installMiniconda'), 'envs'), 'env'));
        assert(setVariable.calledOnceWithExactly('CONDA', absPath('installMiniconda')));
    })

    it('does not download Conda if found, creates and activates environment', async function () {
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
            getVariable: sinon.stub().withArgs('CONDA').returns(absPath('path-to-conda'))
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
        assert(hasConda.calledOnceWithExactly(absPath('path-to-conda'), Platform.Linux));
        assert(downloadMiniconda.notCalled);
        assert(prependCondaToPath.calledOnceWithExactly(absPath('path-to-conda'), Platform.Linux));
        assert(createEnvironment.calledOnceWithExactly(path.join(absPath('path-to-conda'), 'envs'), 'env', undefined, undefined));
        assert(activateEnvironment.calledOnceWithExactly(path.join(absPath('path-to-conda'), 'envs'), 'env'));
    })

    it('does not download Conda if not found and user opts not to', async function (done: MochaDone) {
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
            getVariable: sinon.stub().withArgs('CONDA').returns(absPath('path-to-conda'))
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
            assert.strictEqual(e.message, `loc_mock_CondaNotFound ${absPath('path-to-conda')}`);
            assert(hasConda.calledOnceWithExactly(absPath('path-to-conda'), Platform.Windows));
            assert(downloadMiniconda.notCalled);
            assert(prependCondaToPath.notCalled);
            assert(installMiniconda.notCalled);
            assert(createEnvironment.notCalled);
            assert(activateEnvironment.notCalled);
            done();
        }
    })

    // Test conda_internal.ts

    it('finds the Conda executable', async function () {
        const existsSync = sinon.stub().returns(true);
        const statSync = sinon.stub().returns({
            isFile: () => true
        });

        mockery.registerMock('fs', {
            existsSync: existsSync,
            statSync: statSync
        });

        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockery.registerMock('vsts-task-tool-lib/tool', {});

        { // executable exists and is a file
            const uut = reload('../conda_internal');

            assert(uut.hasConda(absPath('path-to-conda'), Platform.Linux));
            assert(uut.hasConda(absPath('path-to-conda'), Platform.MacOS));
            assert(uut.hasConda(absPath('path-to-conda'), Platform.Windows));
        }
        { // `conda` executable does not exist (Linux / macOS)
            existsSync.withArgs(path.join(absPath('path-to-conda'), 'bin', 'conda')).returns(false);
            const uut = reload('../conda_internal');

            assert(!uut.hasConda(absPath('path-to-conda'), Platform.Linux));
            assert(!uut.hasConda(absPath('path-to-conda'), Platform.MacOS));
        }
        { // `conda.exe` executable does not exist (Windows)
            existsSync.reset();
            existsSync.withArgs(path.join(absPath('path-to-conda'), 'Scripts', 'conda.exe')).returns(false);
            const uut = reload('../conda_internal');

            assert(!uut.hasConda(absPath('path-to-conda'), Platform.Windows));
        }
        { // `conda` exists but is not a file
            existsSync.reset();
            existsSync.withArgs(path.join(absPath('path-to-conda'), 'bin', 'conda')).returns(true);
            existsSync.withArgs(path.join(absPath('path-to-conda'), 'Scripts', 'conda.exe')).returns(true);
            statSync.returns({
                isFile: () => false
            });

            const uut = reload('../conda_internal');

            assert(!uut.hasConda(absPath('path-to-conda'), Platform.Linux));
            assert(!uut.hasConda(absPath('path-to-conda'), Platform.MacOS));
            assert(!uut.hasConda(absPath('path-to-conda'), Platform.Windows));
        }
    })

    it('downloads Miniconda', async function () {
        const downloadTool = sinon.stub().returns('downloadTool');
        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockery.registerMock('vsts-task-tool-lib/tool', {
            downloadTool: downloadTool
        });

        const uut = reload('../conda_internal');

        { // Linux
            const actual = await uut.downloadMiniconda(Platform.Linux);
            assert(downloadTool.calledOnceWithExactly('https://repo.continuum.io/miniconda/Miniconda2-latest-Linux-x86_64.sh'));
        }
        { // macOS
            downloadTool.resetHistory();
            const actual = await uut.downloadMiniconda(Platform.MacOS);
            assert(downloadTool.calledOnceWithExactly('https://repo.continuum.io/miniconda/Miniconda3-latest-MacOSX-x86_64.sh'));
        }
        { // Windows
            downloadTool.resetHistory();
            const actual = await uut.downloadMiniconda(Platform.Windows);
            assert(downloadTool.calledOnceWithExactly('https://repo.continuum.io/miniconda/Miniconda3-latest-Windows-x86_64.exe'));
        }
    })

    it('installs Miniconda', async function () {
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
            getVariable: sinon.stub().withArgs('AGENT_TOOLSDIRECTORY').returns(absPath('_tools'))
        }));

        { // Linux
            mockToolRunner.setAnswers({
                exec: {
                    'bash installer.sh -b -f -p /_tools/Miniconda': {
                        code: 0
                    },
                    // work around for running tests cross-platform
                    'bash installer.sh -b -f -p \\_tools\\Miniconda': {
                        code: 0
                    },
                }
            });

            mockery.registerMock('vsts-task-lib/toolrunner', mockToolRunner);
            mockery.registerMock('vsts-task-tool-lib/tool', {});
            const uut = reload('../conda_internal');

            const actual = await uut.installMiniconda(absPath('installer.sh'), Platform.Windows);
            assert.strictEqual(actual, path.join('_tools', 'Miniconda'));
        }
        { // macOS
            mockToolRunner.setAnswers({
                exec: {
                    'bash installer.sh -b -f -p /_tools/Miniconda': {
                        code: 0
                    },
                    // work around for running tests cross-platform
                    'bash installer.sh -b -f -p \\_tools\\Miniconda': {
                        code: 0
                    },
                }
            });

            mockery.registerMock('vsts-task-lib/toolrunner', mockToolRunner);
            const uut = reload('../conda_internal');

            const actual = await uut.installMiniconda(absPath('installer.sh'), Platform.Windows);
            assert.strictEqual(actual, path.join('_tools', 'Miniconda'));
        }
        { // Windows
            mockToolRunner.setAnswers({
                exec: {
                    'start /wait "" installer.exe /S /AddToPath=0 /RegisterPython=0 /D=\\_tools\\Miniconda': {
                        code: 0
                    },
                    // work around for running tests cross-platform
                    'start /wait "" installer.exe /S /AddToPath=0 /RegisterPython=0 /D=/_tools/Miniconda': {
                        code: 0
                    },
                }
            });

            mockery.registerMock('vsts-task-lib/toolrunner', mockToolRunner);
            const uut = reload('../conda_internal');

            const actual = await uut.installMiniconda(absPath('installer.exe'), Platform.Windows);
            assert.strictEqual(actual, path.join('_tools', 'Miniconda'));
        }
    })

    it('creates Conda environment', async function () {
        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockToolRunner.setAnswers({
            exec: {
                'conda create --quiet --yes --prefix envsDir --mkdir --name env': {
                    code: 0
                }
            }
        });

        mockery.registerMock('vsts-task-lib/toolrunner', mockToolRunner);
        mockery.registerMock('vsts-task-tool-lib/tool', {});
        const uut = reload('../conda_internal');

        await uut.createEnvironment('envsDir', 'env');
    })

    it('activates Conda environment', async function () {
        const prependPath = sinon.spy();
        const setVariable = sinon.spy();
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, {
            prependPath: prependPath,
            setVariable: setVariable
        }));

        mockery.registerMock('vsts-task-tool-lib/tool', {});
        const uut = reload('../conda_internal');

        uut.activateEnvironment(absPath('envs'), 'env');
        assert(prependPath.calledOnceWithExactly(path.join(absPath('envs'), 'envs')));
        assert(setVariable.callCount === 3);
        assert(setVariable.calledWithExactly('CONDA_DEFAULT_ENV', 'env'));
        assert(setVariable.calledWithExactly('CONDA_PREFIX', path.join(absPath('envs'), 'envs')));
        assert(setVariable.calledWithExactly('CONDA_PROMPT_MODIFIER', '(env)'));
    })
});
