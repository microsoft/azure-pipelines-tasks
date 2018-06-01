import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'vsts-task-lib/mock-test';

describe('UseRubyVersion L0 Suite', function () {
    
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before(() => {
    });

    after(() => {
    });

    it('finds version in cache in Linux', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0FindVersionInLinuxCache.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("setVariable") >= 0, "variable was not set as expected");
        //process.env['rubyLocation'] === path.join('/', 'Ruby', '2.5.4', 'bin'), 'ruby location is not set as expected');
    
        done();
    });
        

    /*it('rejects version not in cache', async function (done: MochaDone) {
        mockery.registerMock('vsts-task-lib/task', mockTask);
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => null,
            findLocalToolVersions: () => ['2.7.13']
        });

        const uut = reload();
        const parameters = {
            versionSpec: '3.x',
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
        const buildVariables: { [key: string]: string } = { 'PATH': '' };
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

        let mockPath = '';
        const toolPath = path.join('/', 'Ruby', '2.4.4');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath,
            prependPath: (s: string) => {
                mockPath = s + ':' + mockPath;
            }
        });

        const uut = reload();
        const parameters = {
            versionSpec: '2.4',
            addToPath: true
        };

        await uut.useRubyVersion(parameters, uut.Platform.Linux);
        assert.strictEqual(`${path.join(toolPath, 'bin')}:`, mockPath);
    });

    it('sets PATH correctly on Windows', async function () {
        const buildVariables: { [key: string]: string } = { 'PATH': '' };
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

        let mockPath = '';
        const toolPath = path.join('/', 'Ruby', '2.4.4');
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => toolPath,
            prependPath: (s: string) => {
                mockPath = s + ';' + mockPath;
            }
        });

        const uut = reload();
        const parameters = {
            versionSpec: '2.4',
            addToPath: true
        };

        await uut.useRubyVersion(parameters, uut.Platform.Windows);
        assert.strictEqual(`${path.join(toolPath, 'bin')};`, mockPath);
    });*/
});
