import * as assert from 'assert';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';
import * as mockTask from 'azure-pipelines-task-lib/mock-task';

import { Platform } from '../taskutil';
import * as usePythonVersion from '../usepythonversion';
import { TaskParameters } from '../interfaces';

/** Reload the unit under test to use mocks that have been registered. */
function reload(): typeof usePythonVersion {
    return require('../usepythonversion');
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

it('sets PATH correctly on Linux', async function () {
    mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

    const findLocalTool = sinon.stub().returns('findLocalTool');
    mockery.registerMock('azure-pipelines-tool-lib/tool', {
        findLocalTool
    });

    const prependPathSafe = sinon.spy();
    mockery.registerMock('./toolutil', {
        prependPathSafe
    });

    const uut = reload();
    const parameters: TaskParameters = {
        versionSpec: '3.6',
        disableDownloadFromRegistry: false,
        allowUnstable: true,
        addToPath: true,
        architecture: 'x64',
        githubToken: 'testgithubtoken'
    };

    await uut.usePythonVersion(parameters, Platform.Linux);
    assert(findLocalTool.calledOnceWithExactly('Python', '3.6', 'x64'));
    assert(prependPathSafe.calledWithExactly('findLocalTool'));
    assert(prependPathSafe.calledWithExactly(path.join('findLocalTool', 'bin')));
    assert(prependPathSafe.calledTwice);
});

it('sets PATH correctly on Windows', async function () {
    mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

    // Windows PATH logic will parse this path, so it has to be realistic
    const toolPath = path.join('/', 'Python', '3.6.4', 'x64');
    const findLocalTool = sinon.stub().returns(toolPath);
    mockery.registerMock('azure-pipelines-tool-lib/tool', {
        findLocalTool
    });

    const prependPathSafe = sinon.spy();
    mockery.registerMock('./toolutil', {
        prependPathSafe
    });

    process.env['APPDATA'] = '/mock-appdata'; // needed for running this test on Linux and macOS

    const uut = reload();
    const parameters: TaskParameters = {
        versionSpec: '3.6',
        disableDownloadFromRegistry: false,
        allowUnstable: true,
        addToPath: true,
        architecture: 'x64',
        githubToken: 'testgithubtoken'
    };

    await uut.usePythonVersion(parameters, Platform.Windows);
    assert(findLocalTool.calledOnceWithExactly('Python', '3.6', 'x64'));
    assert(prependPathSafe.calledWithExactly(toolPath));

    // On Windows, must add the two "Scripts" directories to PATH as well
    const expectedScripts = path.join(toolPath, 'Scripts');
    assert(prependPathSafe.calledWithExactly(expectedScripts));
    const expectedUserScripts = path.join(process.env['APPDATA'], 'Python', 'Python36', 'Scripts');
    assert(prependPathSafe.calledWithExactly(expectedUserScripts));
    assert(prependPathSafe.calledThrice);
});