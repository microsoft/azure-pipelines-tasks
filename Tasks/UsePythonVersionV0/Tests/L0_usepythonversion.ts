import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';

import * as mockery from 'mockery';
import * as sinon from 'sinon';
import * as mockTask from 'vsts-task-lib/mock-task';

import { Platform } from '../taskutil';
import * as usePythonVersion from '../usepythonversion';

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

it('converts Python prerelease versions to the semantic version format', function () {
    mockery.registerMock('vsts-task-lib/task', mockTask);
    mockery.registerMock('vsts-task-tool-lib/tool', {});
    const uut = reload();

    const testCases = [
        {
            versionSpec: '3.x',
            expected: '3.x'
        },
        {
            versionSpec: '3.3.6',
            expected: '3.3.6'
        },
        {
            versionSpec: '3.7.0b2',
            expected: '3.7.0-b2'
        },
        {
            versionSpec: '3.7.0rc',
            expected: '3.7.0-rc'
        },
        {
            versionSpec: '14.22.100a1000',
            expected: '14.22.100-a1000'
        },
        {
            versionSpec: '3.6.6b2 || >= 3.7.0rc',
            expected: '3.6.6-b2 || >= 3.7.0-rc'
        },
        {
            versionSpec: '3.7rc1', // invalid
            expected: '3.7rc1'
        },
    ];

    for (let tc of testCases) { // Node 5 can't handle destructuring assignment
        const actual = uut.pythonVersionToSemantic(tc.versionSpec);
        assert.strictEqual(actual, tc.expected);
    }
})

it('sets PATH correctly on Linux', async function () {
    mockery.registerMock('vsts-task-lib/task', mockTask);

    const findLocalTool = sinon.stub().returns('findLocalTool');
    mockery.registerMock('vsts-task-tool-lib/tool', {
        findLocalTool: findLocalTool
    });

    const prependPathSafe = sinon.spy();
    mockery.registerMock('./toolutil', {
        prependPathSafe: prependPathSafe
    });

    const uut = reload();
    const parameters = {
        versionSpec: '3.6',
        addToPath: true,
        architecture: 'x64'
    };

    await uut.usePythonVersion(parameters, Platform.Linux);
    assert(findLocalTool.calledOnceWithExactly('Python', '3.6', 'x64'));
    assert(prependPathSafe.calledTwice);
    assert(prependPathSafe.calledWithExactly('findLocalTool'));
    assert(prependPathSafe.calledWithExactly(path.join('findLocalTool', 'bin')));
});

it('sets PATH correctly on Windows', async function () {
    mockery.registerMock('vsts-task-lib/task', mockTask);

    // Windows PATH logic will parse this path, so it has to be realistic
    const toolPath = path.join('/', 'Python', '3.6.4', 'x64');
    const findLocalTool = sinon.stub().returns(toolPath);
    mockery.registerMock('vsts-task-tool-lib/tool', {
        findLocalTool: findLocalTool
    });

    const prependPathSafe = sinon.spy();
    mockery.registerMock('./toolutil', {
        prependPathSafe: prependPathSafe
    });

    process.env['APPDATA'] = '/mock-appdata'; // needed for running this test on Linux and macOS

    const uut = reload();
    const parameters = {
        versionSpec: '3.6',
        addToPath: true,
        architecture: 'x64'
    };

    await uut.usePythonVersion(parameters, Platform.Windows);
    assert(findLocalTool.calledOnceWithExactly('Python', '3.6', 'x64'));
    assert(prependPathSafe.calledThrice);
    assert(prependPathSafe.calledWithExactly(toolPath));

    // On Windows, must add the two "Scripts" directories to PATH as well
    const expectedScripts = path.join(toolPath, 'Scripts');
    assert(prependPathSafe.calledWithExactly(expectedScripts));
    const expectedUserScripts = path.join(process.env['APPDATA'], 'Python', 'Python36', 'Scripts');
    assert(prependPathSafe.calledWithExactly(expectedUserScripts));
});