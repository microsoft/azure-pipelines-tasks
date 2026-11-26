import assert = require('assert');
import tmrm = require('azure-pipelines-task-lib/mock-test');
import path = require('path');

function runValidations(validator: () => void, tr) {
    try {
        validator();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        throw error;
    }
}

describe('SshV0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('Fails for missing endpoint', async () => {
        delete process.env['sshEndpoint'];
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: sshEndpoint') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    it('Fails when user name is not provided in the endpoint', async () => {
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDUserNameNotSet';
        process.env['commands'] = 'ls -l';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Endpoint auth data not present: IDUserNameNotSet') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    it('Empty password/passphrase is valid in the endpoint', async () => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDPasswordNotSet';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.stderr.indexOf('Input required: password') < 0, 'task should not require password');
        }, tr);
    });

    it('Fails when host is not provided in the endpoint', async () => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDHostNotSet';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Endpoint auth data not present: IDHostNotSet') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    it('When port is not provided in the endpoint, 22 is used as default port number', async () => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDPortNotSet';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.stdout.indexOf('loc_mock_UseDefaultPort') >= 0, 'default port 22 was not used');
        }, tr);
    });

    it('Fails when connection cannot be made with given details', async () => {
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['commands'] = 'ls -l';
        process.env['runOptions'] = 'commands';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('loc_mock_ConnectionFailed Error: Cannot parse privateKey: Malformed OpenSSH private key. Bad passphrase?') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    it('Fails for missing run options', async () => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'build should have failed');
            assert(tr.stdout.indexOf('Input required: runOptions') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    it('Fails for missing commands', async () => {
        delete process.env['commands'];
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['runOptions'] = 'commands';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: commands') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    it('Fails for missing script path', async () => {
        delete process.env['commands'];
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['runOptions'] = 'script';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: scriptPath') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    it('Fails for missing readyTimeout', async () => {
        process.env['commands'] = 'ls -l';
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['readyTimeout'] = '20000';
        process.env['runOptions'] = 'commands';
        delete process.env['readyTimeout'];

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: readyTimeout') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr);
    });

    describe('shell-specific argument validation', function () {
        const cases = [
            { name: 'allows backslash-escaped semicolons for Bash', args: 'safe\\; date', powerShell: false, allowed: true },
            { name: 'rejects backtick-escaped semicolons for Bash', args: 'safe`; date', powerShell: false, allowed: false },
            { name: 'rejects backslash-escaped semicolons for PowerShell', args: 'safe\\; Get-Date', powerShell: true, allowed: false },
            { name: 'allows backtick-escaped semicolons for PowerShell', args: 'safe`; Get-Date', powerShell: true, allowed: true }
        ];

        for (const testCase of cases) {
            it(testCase.name, async () => {
                const previousArgs = process.env['SSH_TEST_ARGS'];
                const previousShell = process.env['SSH_TEST_POWERSHELL'];
                const tr = new tmrm.MockTestRunner(path.join(__dirname, 'L0ScriptArgs.js'));
                try {
                    process.env['SSH_TEST_ARGS'] = testCase.args;
                    process.env['SSH_TEST_POWERSHELL'] = String(testCase.powerShell);
                    await tr.runAsync();
                } finally {
                    if (previousArgs === undefined) {
                        delete process.env['SSH_TEST_ARGS'];
                    } else {
                        process.env['SSH_TEST_ARGS'] = previousArgs;
                    }
                    if (previousShell === undefined) {
                        delete process.env['SSH_TEST_POWERSHELL'];
                    } else {
                        process.env['SSH_TEST_POWERSHELL'] = previousShell;
                    }
                }

                runValidations(() => {
                    assert.strictEqual(tr.succeeded, testCase.allowed, 'unexpected validation result');
                    assert(tr.stdout.includes(`SHELL_PROBE:${testCase.powerShell ? 0 : 127}`), 'should detect the target shell');
                    const command = `SCRIPT_EXECUTED:./L0ScriptArgs.js ${testCase.args}`;
                    assert.strictEqual(tr.stdout.includes(command), testCase.allowed, 'allowed args should execute unchanged; rejected args should not execute');
                    if (!testCase.allowed) {
                        assert(tr.stdout.includes('loc_mock_ScriptArgsSanitized'), 'should fail because argument validation rejected the input');
                    }
                }, tr);
            });
        }
    });

    describe('escapeVsoCommands', function () {
        it('escapes ##vso logging commands from remote output', async () => {
            process.env['sshEndpoint'] = 'IDValidPwd';
            process.env['commands'] = 'cat motd.txt';
            process.env['runOptions'] = 'commands';
            process.env['readyTimeout'] = '20000';
            delete process.env['enableRemoteVsoCommands'];
            delete process.env['splitVsoCommand'];

            let tp = path.join(__dirname, 'L0VsoCommandInjection.js');
            var tr = new tmrm.MockTestRunner(tp);

            await tr.runAsync();

            runValidations(() => {
                assert(tr.stdout.indexOf('##_vso[task.setvariable variable=INJECTED]hacked') >= 0, 'remote ##vso command should be escaped: "' + tr.stdout + '"');
                assert(tr.stdout.indexOf('##vso[task.setvariable') < 0, 'raw ##vso command should not reach the agent: "' + tr.stdout + '"');
            }, tr);
        });

        it('escapes ##vso logging commands split across output chunks', async () => {
            process.env['sshEndpoint'] = 'IDValidPwd';
            process.env['commands'] = 'cat motd.txt';
            process.env['runOptions'] = 'commands';
            process.env['readyTimeout'] = '20000';
            process.env['splitVsoCommand'] = 'true';
            delete process.env['enableRemoteVsoCommands'];

            let tp = path.join(__dirname, 'L0VsoCommandInjection.js');
            var tr = new tmrm.MockTestRunner(tp);

            await tr.runAsync();
            delete process.env['splitVsoCommand'];

            runValidations(() => {
                assert(tr.stdout.indexOf('##_vso[task.setvariable variable=INJECTED]hacked') >= 0, 'split remote ##vso command should be escaped: "' + tr.stdout + '"');
                assert(tr.stdout.indexOf('##vso[task.setvariable') < 0, 'split raw ##vso command should not reach the agent: "' + tr.stdout + '"');
            }, tr);
        });

        it('allows split ##vso logging commands when explicitly enabled', async () => {
            process.env['sshEndpoint'] = 'IDValidPwd';
            process.env['commands'] = 'cat motd.txt';
            process.env['runOptions'] = 'commands';
            process.env['readyTimeout'] = '20000';
            process.env['enableRemoteVsoCommands'] = 'true';
            process.env['splitVsoCommand'] = 'true';

            let tp = path.join(__dirname, 'L0VsoCommandInjection.js');
            var tr = new tmrm.MockTestRunner(tp);

            await tr.runAsync();
            delete process.env['enableRemoteVsoCommands'];
            delete process.env['splitVsoCommand'];

            runValidations(() => {
                assert(tr.stdout.indexOf('##vso[task.setvariable variable=INJECTED]hacked') >= 0, 'trusted remote ##vso command should remain unchanged: "' + tr.stdout + '"');
            }, tr);
        });
    });
});