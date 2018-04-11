import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';

import * as mockery from 'mockery';
import * as mockTask from 'vsts-task-lib/mock-task';

import { Platform } from '../taskutil';
import * as usePythonVersion from '../usepythonversion';

/** Reload the unit under test to use mocks that have been registered. */
function reload(): typeof usePythonVersion {
    return require('../usepythonversion');
}

describe('UsePythonVersion L0 Suite', function () {
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

    it('finds version in cache', async function () {
        let buildVariables: { [key: string]: string } = {};
        const mockBuildVariables = {
            setVariable: (variable: string, value: string) => {
                buildVariables[variable] = value;
            },
            getVariable: (variable: string) => buildVariables[variable]
        };
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, mockBuildVariables));

        const toolPath = path.join('/', 'Python', '3.6.4', 'x64');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath
        });

        const uut = reload();
        const parameters = {
            versionSpec: '3.6',
            addToPath: false,
            architecture: 'x64'
        };

        assert.strictEqual(buildVariables['pythonLocation'], undefined);

        await uut.usePythonVersion(parameters, Platform.Linux);
        assert.strictEqual(buildVariables['pythonLocation'], toolPath);
    });

    it('rejects version not in cache', async function (done: MochaDone) {
        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => null,
            findLocalToolVersions: () => ['2.6.0', '2.7.13']
        });

        const uut = reload();
        const parameters = {
            versionSpec: '3.x',
            addToPath: false,
            architecture: 'x64'
        };

        try {
            await uut.usePythonVersion(parameters, Platform.Linux);
            done(new Error('should not have succeeded'));
        } catch (e) {
            const expectedMessage = [
                'loc_mock_VersionNotFound 3.x',
                'loc_mock_ListAvailableVersions',
                '2.6.0 (x86)',
                '2.7.13 (x86)',
                '2.6.0 (x64)',
                '2.7.13 (x64)'
            ].join(EOL);

            assert.strictEqual(e.message, expectedMessage);
            done();
        }
    });

    it('selects architecture passed as input', async function () {
        let buildVariables: { [key: string]: string } = {};
        const mockBuildVariables = {
            setVariable: (variable: string, value: string) => {
                buildVariables[variable] = value;
            },
            getVariable: (variable: string) => buildVariables[variable]
        };
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, mockBuildVariables));

        const x86ToolPath = path.join('/', 'Python', '3.6.4', 'x86');
        const x64ToolPath = path.join('/', 'Python', '3.6.4', 'x64');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: (toolName: string, versionSpec: string, arch?: string) => {
                if (arch === 'x86') {
                    return x86ToolPath;
                } else {
                    return x64ToolPath;
                }
            }
        });

        const uut = reload();
        const parameters = {
            versionSpec: '3.6',
            addToPath: false,
            architecture: 'x86'
        };

        assert.strictEqual(buildVariables['pythonLocation'], undefined);

        await uut.usePythonVersion(parameters, Platform.Linux);
        assert.strictEqual(buildVariables['pythonLocation'], x86ToolPath);
    });

    it('sets PATH correctly on Linux', async function () {
        mockery.registerMock('vsts-task-lib/task', mockTask);

        const toolPath = path.join('/', 'Python', '3.6.4', 'x64');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath,
        });

        let mockPath = '';
        mockery.registerMock('./toolutil', {
            prependPathSafe: (s: string) => {
                mockPath = s + ':' + mockPath;
            }
        });

        const uut = reload();
        const parameters = {
            versionSpec: '3.6',
            addToPath: true,
            architecture: 'x64'
        };

        await uut.usePythonVersion(parameters, Platform.Linux);
        assert.strictEqual(`${toolPath}:`, mockPath);
    });

    it('sets PATH correctly on Windows', async function () {
        mockery.registerMock('vsts-task-lib/task', mockTask);

        const toolPath = path.join('/', 'Python', '3.6.4', 'x64');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath
        });

        let mockPath = '';
        mockery.registerMock('./toolutil', {
            prependPathSafe: (s: string) => {
                mockPath = s + ';' + mockPath;
            }
        });

        process.env['APPDATA'] = '/mock-appdata';

        const uut = reload();
        const parameters = {
            versionSpec: '3.6',
            addToPath: true,
            architecture: 'x64'
        };

        await uut.usePythonVersion(parameters, Platform.Windows);

        // On Windows, must add the two "Scripts" directories to PATH as well
        const expectedScripts = path.join(toolPath, 'Scripts');
        const expectedUserScripts = path.join(process.env['APPDATA'], 'Python', 'Python36', 'Scripts');
        const expectedPath = `${expectedUserScripts};${expectedScripts};${toolPath};`;
        assert.strictEqual(expectedPath, mockPath);
    });
});
