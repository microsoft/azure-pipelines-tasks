import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';

import * as mockery from 'mockery';
import * as mockTask from 'vsts-task-lib/mock-task';
import * as useRubyVersion from '../userubyversion';

/** Reload the unit under test to use mocks that have been registered. */
function reload(): typeof useRubyVersion {
    return require('../userubyversion');
}

describe('UseRubyVersion L0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 2000);

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

    it('finds version in cache in Linux', async function () {
        const buildVariables: any = {};
        const mockTaskRun = {
            setVariable: (variable: string, value: string) => {
                buildVariables[variable] = value;
            },
            getVariable: (variable: string) => buildVariables[variable]
        };
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, mockTaskRun));
        mockery.registerMock('fs', {
            symlinkSync: () => {},
            unlinkSync: () => {},
            existsSync: () => {}
        });

        const toolPath = path.join('/', 'Ruby', '2.5.4');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath
        });
        const uut = reload();
        const parameters = {
            versionSpec: '= 2.5',
            outputVariable: 'Ruby',
            addToPath: false
        };
        await uut.useRubyVersion(parameters, uut.Platform.Linux);
        assert.strictEqual(buildVariables['Ruby'], path.join(toolPath, 'bin'));
    });
    it('rejects version not in cache', async function (done: MochaDone) {
        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => null,
            findLocalToolVersions: () => ['2.7.13']
        });

        const uut = reload();
        const parameters = {
            versionSpec: '3.x',
            outputVariable: 'Ruby',
            addToPath: false
        };

        try {
            await uut.useRubyVersion(parameters, uut.Platform.Linux);
            done(new Error('should not have succeeded'));
        } catch (e) {
            const expectedMessage = [
                'loc_mock_VersionNotFound 3.x',
                'loc_mock_ListAvailableVersions',
                '2.7.13'
            ].join(EOL);

            assert.strictEqual(e.message, expectedMessage);
            done();
        }
    });

    it('sets PATH correctly on Linux', async function () {
        const buildVariables: any = { 'PATH': '' };
        const mockTaskRun = {
            setVariable: (variable: string, value: string) => {
                buildVariables[variable] = value;
            },
            getVariable: (variable: string) => buildVariables[variable]
        };
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, mockTaskRun));
        mockery.registerMock('fs', {
            symlinkSync: () => {},
            unlinkSync: () => {},
            existsSync: () => {}
        });

        const toolPath = path.join('/', 'Ruby', '2.4.4');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath
        });

        const uut = reload();
        const parameters = {
            versionSpec: '2.4',
            outputVariable: 'Ruby',
            addToPath: true
        };

        await uut.useRubyVersion(parameters, uut.Platform.Linux);
        assert.strictEqual(`${path.join(toolPath, 'bin')}${path.delimiter}`, buildVariables['PATH']);
    });

    it('sets PATH correctly on Windows', async function () {
        const buildVariables: any = { 'PATH': '' };
        const mockTaskRun = {
            setVariable: (variable: string, value: string) => {
                buildVariables[variable] = value;
            },
            getVariable: (variable: string) => buildVariables[variable]
        };
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, mockTaskRun));
        mockery.registerMock('fs', {
            symlinkSync: () => {},
            unlinkSync: () => {},
            existsSync: () => {}
        });

        const toolPath = path.join('/', 'Ruby', '2.4.4');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath
        });

        const uut = reload();
        const parameters = {
            versionSpec: '2.4',
            outputVariable: 'Ruby',
            addToPath: true
        };

        await uut.useRubyVersion(parameters, uut.Platform.Windows);
        assert.strictEqual(`${toolPath}${path.delimiter}`, buildVariables['PATH']);
    });
});
