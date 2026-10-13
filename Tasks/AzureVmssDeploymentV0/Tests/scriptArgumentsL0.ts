import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import ttm = require('azure-pipelines-task-lib/mock-test');
import { commandFromString } from 'azure-pipelines-task-lib/taskcommand';
import { spawnSync } from 'child_process';
import { ArgsSanitizingError, tryValidateScriptArgs, validateScriptArgs } from '../operations/argsSanitizer';

describe('VMSS PowerShell argument validation', function () {
    this.timeout(60000);
    const environmentKeys = [
        'DISTRIBUTEDTASK_TASKS_ENABLEVMSSCUSTOMSCRIPTARGSVALIDATION',
        'AZP_75787_ENABLE_NEW_LOGIC', 'AZP_75787_ENABLE_NEW_LOGIC_LOG', 'AZP_75787_ENABLE_COLLECT',
        '_scriptArgs_', '_argsValidationMode_', '_doNotArchive_', '_vmssOsType_', 'existingExtensionName'
    ];
    let savedEnvironment: Record<string, string | undefined>;

    beforeEach(() => {
        savedEnvironment = {};
        for (const key of environmentKeys) {
            savedEnvironment[key] = process.env[key];
            delete process.env[key];
        }
        process.env['DISTRIBUTEDTASK_TASKS_ENABLEVMSSCUSTOMSCRIPTARGSVALIDATION'] = 'true';
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
    });
    afterEach(() => {
        for (const key of environmentKeys) {
            if (savedEnvironment[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnvironment[key];
            }
        }
    });

    for (const args of ['', 'plain value', 'a`;b', 'a```;b', '-Flag $true', '-Flag $FALSE',
        '@{ k = "value" }', '"literal @{[value]}"']) {
        it(`accepts allowed characters through the real helper: ${JSON.stringify(args)}`, () => {
            assert.doesNotThrow(() => validateScriptArgs(args, 'ps'));
        });
    }
    for (const args of ['``; Get-Date', '``& Get-Date', '``| Get-Date', '````; Get-Date',
        ';true', '|false', '>true', '$trueSuffix', '$falseSuffix',
        'value\nnext', 'value`\nnext', 'value``\nnext', 'value\rnext']) {
        it(`rejects prohibited characters through the real helper: ${JSON.stringify(args)}`, () => {
            assert.throws(() => validateScriptArgs(args, 'ps'), ArgsSanitizingError);
        });
    }
    it('does not call the validator when the outer gate is disabled', () => {
        process.env['DISTRIBUTEDTASK_TASKS_ENABLEVMSSCUSTOMSCRIPTARGSVALIDATION'] = 'false';
        tryValidateScriptArgs(';true', 'ps', () => { assert.fail('validator must not run'); });
    });
    for (const mode of ['disabled', 'audit', 'telemetry']) {
        it(`retains non-enforcing character validation in ${mode} mode`, () => {
            process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'false';
            process.env['AZP_75787_ENABLE_NEW_LOGIC_LOG'] = mode === 'audit' ? 'true' : 'false';
            process.env['AZP_75787_ENABLE_COLLECT'] = mode === 'telemetry' ? 'true' : 'false';
            assert.doesNotThrow(() => validateScriptArgs(';true', 'ps'));
        });
    }

    async function getInvokerCommand(args: string, mode = 'activate', targetOs = 'Windows'): Promise<string> {
        process.env['_scriptArgs_'] = args;
        process.env['_argsValidationMode_'] = mode;
        process.env['_doNotArchive_'] = 'true';
        process.env['_vmssOsType_'] = targetOs;
        process.env['existingExtensionName'] = 'extensionNameTest';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'updateImageOnWindowsAgent.js'));
        await runner.runAsync();
        assert(runner.succeeded, runner.stdout + runner.stderr);
        // Replay decoded command data, not its percent-escaped logging representation.
        const debugLine = runner.stdout.split(/\r?\n/).find(line => line.startsWith('##vso[task.debug]Invoker command: '));
        assert(debugLine, 'the task must produce an invoker command');
        return commandFromString(debugLine).message.substring('Invoker command: '.length);
    }

    for (const mode of ['activate', 'outer-off', 'disabled', 'audit', 'telemetry']) {
        it(`propagates the exact enforcement state to the Windows VM in ${mode} mode`, async () => {
            const command = await getInvokerCommand('plain', mode);
            assert.strictEqual(command.endsWith(' -validateArgs'), mode === 'activate');
        });
    }
    it('does not add Windows validation to a Linux target', async () => {
        const command = await getInvokerCommand('plain', 'activate', 'Linux');
        assert(command.includes('customScriptInvoker.sh'));
        assert(!command.includes('-validateArgs'));
    });
    it('rejects a Boolean-prefix separator before upload or extension update', async () => {
        process.env['_scriptArgs_'] = ';true';
        process.env['_argsValidationMode_'] = 'activate';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'updateImageOnWindowsAgent.js'));
        await runner.runAsync();
        assert(runner.failed, runner.stdout + runner.stderr);
        assert(runner.stdout.includes('loc_mock_ScriptArgsSanitized'));
        assert(!runner.stdout.includes('blobService.uploadBlobs is called'));
        assert(!runner.stdout.includes('virtualMachineExtensions.createOrUpdate is called'));
    });

    function prepareInvokerFiles(): string {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-argument-tests-'));
        const prefix = path.join(directory, '100-12345', '200', '5');
        fs.mkdirSync(prefix, { recursive: true });
        fs.copyFileSync(path.join(__dirname, '..', 'Resources', 'customScriptInvoker.ps1'),
            path.join(prefix, 'customScriptInvoker.ps1'));
        const fixture = [
            'param([object]$Value, [switch]$Switch, [Parameter(ValueFromRemainingArguments=$true)][object[]]$Remaining)',
            '$result = @{ Value = $Value; Switch = $Switch.IsPresent; Remaining = $Remaining }',
            "Write-Output ('VALUES=' + ($result | ConvertTo-Json -Depth 10 -Compress))"
        ].join('\r\n');
        fs.writeFileSync(path.join(prefix, "de$p`l o'y.ps1"), fixture);
        fs.writeFileSync(path.join(prefix, 'trusted-fixture.ps1'), fixture);
        return directory;
    }
    function boundValues(stdout: string): unknown {
        const match = /^VALUES=(.*)$/m.exec(stdout);
        assert(match, 'the trusted fixture must report its bound argument values');
        return JSON.parse(match[1]);
    }

    for (const args of ['', 'plain', '-Value named -Switch', '"quoted @{[value]}"', 'a`;b',
        '@{ k = 1 }', 'one,two', '-Value $true']) {
        it(`preserves native Windows transport and binding for ${JSON.stringify(args)}`, async function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const command = await getInvokerCommand(args);
            assert(command.endsWith(' -validateArgs'));
            const directory = prepareInvokerFiles();
            try {
                const guarded = spawnSync(command, { shell: true, cwd: directory, encoding: 'utf8', timeout: 15000 });
                assert.ifError(guarded.error);
                assert.strictEqual(guarded.status, 0, guarded.stderr);
                const legacy = spawnSync(command.replace(/ -validateArgs$/, ''),
                    { shell: true, cwd: directory, encoding: 'utf8', timeout: 15000 });
                assert.ifError(legacy.error);
                assert.strictEqual(legacy.status, 0, legacy.stderr);
                assert.deepStrictEqual(boundValues(guarded.stdout), boundValues(legacy.stdout));
            } finally {
                fs.rmSync(directory, { recursive: true, force: true });
            }
        });
    }
    for (const args of ['@{ k = Get-Date }', '@{ k = @{ value = Get-Date } }', '{ value }',
        '@{ k = [string]1 }', '@{ k = 1 + 2 }', '@{ k = [DateTime]::Now }', '@{ k = $false }',
        '--% literal', "@{ k = 'unfinished }"]) {
        it(`rejects executable or unsupported syntax after native Windows decoding: ${JSON.stringify(args)}`, async function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const command = await getInvokerCommand(args);
            const directory = prepareInvokerFiles();
            try {
                const result = spawnSync(command, { shell: true, cwd: directory, encoding: 'utf8', timeout: 15000 });
                assert.ifError(result.error);
                assert.notStrictEqual(result.status, 0, 'unsafe argument syntax must fail');
                assert(result.stderr.includes('Custom script arguments must contain only literal values.'), result.stderr);
                assert(!result.stdout.includes('VALUES='), 'the trusted script must not be invoked');
            } finally {
                fs.rmSync(directory, { recursive: true, force: true });
            }
        });
    }
    for (const args of ['value > ignored.txt', 'value | Get-Date', 'value; Get-Date', 'value\nGet-Date']) {
        it(`independently rejects additional statements, pipelines and redirections on the VM: ${JSON.stringify(args)}`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const directory = prepareInvokerFiles();
            const prefix = path.join(directory, '100-12345', '200', '5');
            try {
                const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
                    path.join(prefix, 'customScriptInvoker.ps1'), '-prefixPath', '100-12345\\200\\5',
                    '-script', '.\\trusted-fixture.ps1', '-scriptArgs', args, '-validateArgs'],
                    { cwd: directory, encoding: 'utf8', timeout: 15000 });
                assert.ifError(result.error);
                assert.notStrictEqual(result.status, 0, 'unsafe argument syntax must fail');
                assert(result.stderr.includes('Custom script arguments must contain only literal values.'), result.stderr);
                assert(!result.stdout.includes('VALUES='));
                assert(!fs.existsSync(path.join(prefix, 'ignored.txt')));
            } finally {
                fs.rmSync(directory, { recursive: true, force: true });
            }
        });
    }
    for (const args of ['-Value $true', '-Value $false', '@{ k = $false }']) {
        it(`accepts Boolean constant nodes when they reach the VM unchanged: ${args}`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const directory = prepareInvokerFiles();
            const prefix = path.join(directory, '100-12345', '200', '5');
            try {
                const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
                    path.join(prefix, 'customScriptInvoker.ps1'), '-prefixPath', '100-12345\\200\\5',
                    '-script', '.\\trusted-fixture.ps1', '-scriptArgs', args, '-validateArgs'],
                    { cwd: directory, encoding: 'utf8', timeout: 15000 });
                assert.ifError(result.error);
                assert.strictEqual(result.status, 0, result.stderr);
                assert.deepStrictEqual(boundValues(result.stdout),
                    { Value: args.startsWith('@{') ? { k: false } : args.endsWith('$true'), Switch: false, Remaining: null });
            } finally {
                fs.rmSync(directory, { recursive: true, force: true });
            }
        });
    }
});
