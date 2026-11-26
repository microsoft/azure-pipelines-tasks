import assert = require('assert');
import fs = require('fs');
import path = require('path');
import vm = require('vm');

function loadTaskFilter(changedFiles: string[]) {
    const ciPath = path.resolve(__dirname, '../../ci');
    const tasksPath = path.resolve(ciPath, '../Tasks');
    const consumerPath = path.join(tasksPath, 'ConsumerTask');
    const directPath = path.join(tasksPath, 'DirectTask');
    const source = fs.readFileSync(path.join(ciPath, 'filter-tasks.js'), 'utf8')
        .replace(/\bfilterTasks\(\);\s*$/, '');
    const context = {
        __dirname: ciPath,
        console: { log: () => {} },
        process: {
            env: {
                BUILD_REASON: 'pullrequest',
                SYSTEM_PULLREQUEST_PULLREQUESTNUMBER: '22613',
                SYSTEM_PULLREQUEST_SOURCEBRANCH: 'users/test',
                SYSTEM_PULLREQUEST_TARGETBRANCH: 'master',
                SKIPBUMPINGVERSIONSDUETOCHANGESINCOMMON: 'false'
            }
        },
        require: (name: string) => {
            if (name === 'fs') {
                return {
                    existsSync: (file: string) => [
                        consumerPath, directPath,
                        path.join(consumerPath, 'make.json'),
                        path.join(directPath, 'make.json')
                    ].indexOf(file) >= 0,
                    readFileSync: (file: string) => {
                        if (path.basename(file) === 'make-options.json') {
                            return JSON.stringify({ tasks: ['ConsumerTask', 'DirectTask'] });
                        }
                        if (file === path.join(consumerPath, 'make.json')) {
                            return JSON.stringify({
                                common: [{ module: '../Common/VstsAzureHelpers_' }]
                            });
                        }
                        if (file === path.join(directPath, 'make.json')) {
                            return '{}';
                        }
                        throw new Error(`Unexpected file: ${file}`);
                    }
                };
            }
            if (name === './ci-util') {
                return {
                    run: (command: string) => {
                        if (command.indexOf('git fetch ') === 0) {
                            return '';
                        }
                        if (command.indexOf('git merge-base ') === 0) {
                            return 'base';
                        }
                        if (command.indexOf('git --no-pager diff --name-only ') === 0) {
                            return changedFiles.join('\n');
                        }
                        throw new Error(`Unexpected command: ${command}`);
                    }
                };
            }
            return require(name);
        },
        getTasksToBuildForPR: (_id: number, _versions: boolean): Promise<string[]> => {
            throw new Error('Task filter has not been loaded');
        }
    };
    vm.runInNewContext(source, context);
    return context.getTasksToBuildForPR;
}

describe('PR task filtering', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    const commonTest = 'Tasks/Common/VstsAzureHelpers_/Tests/L0.ts';
    const commonSource = 'Tasks/Common/VstsAzureHelpers_/Helper.psm1';
    const assertTasks = (actual: string[], expected: string[]) =>
        assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected));

    it('builds shared-test consumers without requiring new task versions', async () => {
        const filter = loadTaskFilter([commonTest]);
        assertTasks(await filter(null, false), ['ConsumerTask']);
        assertTasks(await filter(null, true), []);
    });

    it('still version-checks directly changed tasks alongside shared-test changes', async () => {
        const filter = loadTaskFilter([commonTest, 'Tasks/DirectTask/task.json']);
        assertTasks(await filter(null, false), ['DirectTask', 'ConsumerTask']);
        assertTasks(await filter(null, true), ['DirectTask']);
    });

    it('still version-checks tests changed directly inside a task', async () => {
        const filter = loadTaskFilter(['Tasks/ConsumerTask/Tests/L0.ts']);
        assertTasks(await filter(null, false), ['ConsumerTask']);
        assertTasks(await filter(null, true), ['ConsumerTask']);
    });

    it('still builds and version-checks production shared-code consumers', async () => {
        const filter = loadTaskFilter([commonSource, 'Tasks/ConsumerTask/task.json']);
        assertTasks(await filter(null, false), ['ConsumerTask']);
        assertTasks(await filter(null, true), ['ConsumerTask']);
    });

    it('still requires version bumps for production shared-code changes', async () => {
        const filter = loadTaskFilter([commonSource]);
        for (const versions of [false, true]) {
            let rejected = false;
            try {
                await filter(null, versions);
            } catch (error) {
                assert.ok(/versions bumped due to changes in common: ConsumerTask/.test(error.message));
                rejected = true;
            }
            assert.ok(rejected, 'Production shared-code changes must require a task version bump');
        }
    });
});
