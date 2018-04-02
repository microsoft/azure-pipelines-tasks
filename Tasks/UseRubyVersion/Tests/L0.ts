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
        const which: any = {
            'ruby-switch': '/usr/bin/ruby-switch'
        };
        const toolSetCommand: string = 'sudo ruby-switch --set ruby2.5';
        const willRun: any = {
            'sudo ruby-switch --set ruby2.5': {
                stdout: '',
                code: 0
            },
            'ruby-switch --list': {
                stdout: 'ruby2.5' + EOL + 'ruby2.2' + EOL + 'ruby2.4',
                code: 0
            }
        };
        let toolSet: boolean = false;
        const mockTaskRun = {
            execSync: (command: string, args: string[]) => {
                if (args) {
                    command = command + ' ' + args.join(' ');
                }
                if (command === toolSetCommand) {
                    toolSet = true;
                }
                return willRun[command];
            },
            which: (command: string) => which[command]
        };
        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, mockTaskRun));
        mockery.registerMock('vsts-task-tool-lib/tool', {});
        const uut = reload();
        const parameters = {
            versionSpec: '= 2.5',
            outputVariable: 'Ruby',
            addToPath: false
        };
        await uut.useRubyVersion(parameters, uut.Platform.Linux);
        assert.equal(true, toolSet);
    });

    it('rejects version not in cache', async function (done: MochaDone) {
        const which: any = {
            'ruby-switch': '/usr/bin/ruby-switch'
        };
        const willRun: any = {
            'ruby-switch --list': {
                'stdout': 'ruby2.5' + EOL + 'ruby2.2' + EOL + 'ruby2.4',
                'code': 0
            }
        };
        const mockTaskRun = {
            execSync: (command: string, args: string[]) => {
                if (args) {
                    command = command + ' ' + args.join(' ');
                }
                return willRun[command];
            },
            which: (command: string) => which[command]
        };

        mockery.registerMock('vsts-task-lib/task', Object.assign({}, mockTask, mockTaskRun));
        mockery.registerMock('vsts-task-tool-lib/tool', {});

        const uut = reload();
        const parameters = {
            versionSpec: '= 2.3',
            outputVariable: 'Ruby',
            addToPath: false
        };

        try {
            await uut.useRubyVersion(parameters, uut.Platform.Linux);
            done(new Error('should not have succeeded'));
        } catch (e) {
            const expectedMessage = [
                'loc_mock_VersionNotFound = 2.3',
                'loc_mock_ListAvailableVersions',
                'ruby2.5 ruby2.2 ruby2.4'
            ].join(EOL);

            assert.strictEqual(e.message, expectedMessage);
            done();
        }
    });
});
