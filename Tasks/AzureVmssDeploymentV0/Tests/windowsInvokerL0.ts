import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import ttm = require('azure-pipelines-task-lib/mock-test');
import { commandFromString } from 'azure-pipelines-task-lib/taskcommand';
import { spawnSync } from 'child_process';
import { ArgsSanitizingError, getVmssCustomScriptArgsValidationFixEnabled, tryValidateScriptArgs } from '../operations/argsSanitizer';
import { prepareWindowsInvoker, WindowsInvokerInfo, WindowsInvokerPayloadFileName, WindowsInvokerPayloadLimit } from '../operations/windowsInvoker';

describe('VMSS protected Windows data transport', function () {
    this.timeout(60000);
    const oldFlag = 'DISTRIBUTEDTASK_TASKS_ENABLEVMSSCUSTOMSCRIPTARGSVALIDATION';
    const fixFlag = 'DISTRIBUTEDTASK_TASKS_VMSSCUSTOMSCRIPTARGSVALIDATIONFIXENABLED';
    const keys = [oldFlag, fixFlag, 'AZP_75787_ENABLE_NEW_LOGIC', 'AZP_75787_ENABLE_NEW_LOGIC_LOG',
        'AZP_75787_ENABLE_COLLECT', '_dataProtocolScripts_', '_dataProtocolArgs_', '_protocolOldFlag_',
        '_protocolFixFlag_', '_protocolActivate_', '_uploadCaptureRoot_', 'existingExtensionName'];
    let saved: Record<string, string | undefined>;
    beforeEach(() => {
        saved = {};
        for (const key of keys) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
        process.env[oldFlag] = 'true';
        process.env[fixFlag] = 'true';
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'false';
    });
    afterEach(() => {
        for (const key of keys) {
            if (saved[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = saved[key];
            }
        }
    });

    for (const oldState of ['true', 'false']) {
        for (const fixState of ['true', 'false', 'missing']) {
            it(`uses the additive gates: old=${oldState}, new=${fixState}`, () => {
                process.env[oldFlag] = oldState;
                if (fixState === 'missing') {
                    delete process.env[fixFlag];
                } else {
                    process.env[fixFlag] = fixState;
                }
                assert.strictEqual(getVmssCustomScriptArgsValidationFixEnabled('ps'),
                    oldState === 'true' && fixState === 'true');
                assert.strictEqual(getVmssCustomScriptArgsValidationFixEnabled('bash'), false);
            });
        }
    }
    for (const args of ['``; Get-Date', '``& echo VMSS_ARG_MARKER', '``| Get-Date', ';true',
        '|false', '>true', '$trueSuffix', '$falseSuffix', 'value\nnext', 'value`\nnext', 'value``\nnext']) {
        it(`rejects prohibited syntax on the agent with legacy activation off: ${JSON.stringify(args)}`, () => {
            assert.throws(() => tryValidateScriptArgs(args, 'ps'), ArgsSanitizingError);
        });
    }
    it('allows PowerShell-escaped CMD characters through the real helper as data', () => {
        assert.doesNotThrow(() => tryValidateScriptArgs('a`& echo VMSS_ARG_MARKER `& rem ignore', 'ps'));
    });
    it('retains legacy Boolean-prefix behavior when the new gate is absent', () => {
        delete process.env[fixFlag];
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => tryValidateScriptArgs(';true', 'ps'));
    });
    it('does not override the old outer gate', () => {
        process.env[oldFlag] = 'false';
        tryValidateScriptArgs(';true', 'ps', () => { assert.fail('old gate must remain authoritative'); });
    });

    function scripts(script = 'deploy.ps1', body?: string): string {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-script-fixture-'));
        const filename = path.join(directory, script);
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        const fixture = [
            "param([Alias('V')][object]$Value, [switch]$Switch, [Parameter(ValueFromRemainingArguments=$true)][object[]]$Remaining)",
            "$result = @{ ValueSet = $PSBoundParameters.ContainsKey('Value'); Value = $Value; Switch = $Switch.IsPresent; Remaining = $Remaining }",
            "[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'), ($result | ConvertTo-Json -Depth 10 -Compress), (New-Object System.Text.UTF8Encoding($false)))",
            "Write-Output 'TRUSTED_SCRIPT_RAN'"
        ].join('\r\n');
        fs.writeFileSync(filename, body === undefined ? fixture : body);
        return directory;
    }
    function nativeRun(invoker: WindowsInvokerInfo, root: string, delayedExpansion = false) {
        fs.cpSync(invoker.localDirPath, path.join(root, invoker.blobsPrefixPath), { recursive: true });
        const options = { cwd: root, encoding: 'utf8' as const, timeout: 15000,
            env: { ...process.env, VMSS_LITERAL: 'MUST_NOT_EXPAND' } };
        return delayedExpansion
            ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/v:on', '/s', '/c', `"${invoker.command}"`],
                { ...options, windowsVerbatimArguments: true })
            : spawnSync(invoker.command, { ...options, shell: true });
    }
    function runCase(args: string, expected: object, script = 'deploy.ps1', delayedExpansion = false): void {
        const source = scripts(script);
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-native-test-'));
        let invoker: WindowsInvokerInfo;
        try {
            invoker = prepareWindowsInvoker(source, script, args);
            assert.match(invoker.command, /-File "\.\\vmss-[a-f0-9]{32}\\vmssDataInvoker\.ps1"$/);
            assert(!invoker.command.includes(args) || args === '');
            const result = nativeRun(invoker, root, delayedExpansion);
            assert.ifError(result.error);
            assert.strictEqual(result.status, 0, result.stderr);
            assert(result.stdout.includes('TRUSTED_SCRIPT_RAN'), result.stdout);
            assert(!/^VMSS_ARG_MARKER(?:\s+`)?\s*$/m.test(result.stdout), 'a separate CMD marker command must not execute');
            const output = path.join(root, invoker.blobsPrefixPath, 'scripts', path.dirname(script), 'result.json');
            assert.deepStrictEqual(JSON.parse(fs.readFileSync(output, 'utf8')), expected);
        } finally {
            if (invoker) {
                fs.rmSync(invoker.localDirPath, { recursive: true });
            }
            fs.rmSync(root, { recursive: true });
            fs.rmSync(source, { recursive: true });
        }
    }

    const benignCases: Array<[string, object]> = [
        ['', { ValueSet: false, Value: null, Switch: false, Remaining: null }],
        ["''", { ValueSet: true, Value: '', Switch: false, Remaining: null }],
        ['$false', { ValueSet: true, Value: false, Switch: false, Remaining: null }],
        ['$null', { ValueSet: true, Value: null, Switch: false, Remaining: null }],
        ['-V named -Switch', { ValueSet: true, Value: 'named', Switch: true, Remaining: null }],
        ['-Va named -Switch:$false', { ValueSet: true, Value: 'named', Switch: false, Remaining: null }],
        ['"quoted @{[value]}"', { ValueSet: true, Value: 'quoted @{[value]}', Switch: false, Remaining: null }],
        ['a`;b', { ValueSet: true, Value: 'a;b', Switch: false, Remaining: null }],
        ['@{ k = 1 }', { ValueSet: true, Value: { k: 1 }, Switch: false, Remaining: null }],
        ['@{ k = $false }', { ValueSet: true, Value: { k: false }, Switch: false, Remaining: null }],
        ['one,two', { ValueSet: true, Value: ['one', 'two'], Switch: false, Remaining: null }],
        ['"\u03bb \u4e16\u754c"', { ValueSet: true, Value: '\u03bb \u4e16\u754c', Switch: false, Remaining: null }],
        ["'%VMSS_LITERAL% !VMSS_LITERAL!'", { ValueSet: true, Value: '%VMSS_LITERAL% !VMSS_LITERAL!', Switch: false, Remaining: null }],
        ['a`& echo VMSS_ARG_MARKER `& rem ignore',
            { ValueSet: true, Value: 'a&', Switch: false, Remaining: ['echo', 'VMSS_ARG_MARKER', '&', 'rem', 'ignore'] }]
    ];
    for (const [args, expected] of benignCases) {
        it(`preserves native data binding without CMD marker execution: ${JSON.stringify(args)}`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            runCase(args, expected);
        });
    }
    it('keeps metacharacters in the selected script filename out of CMD', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        runCase('plain', { ValueSet: true, Value: 'plain', Switch: false, Remaining: null },
            "de'p`l & %VMSS_LITERAL% !\u03bb.ps1");
    });
    it('keeps delayed CMD expansion out of argument data', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        runCase("'%VMSS_LITERAL% !VMSS_LITERAL!'", { ValueSet: true, Value: '%VMSS_LITERAL% !VMSS_LITERAL!', Switch: false, Remaining: null },
            'deploy.ps1', true);
    });

    for (const args of ['@{ k = Get-Date }', '@{ k = @{ v = Get-Date } }', '{ value }',
        '@{ k = [string]1 }', '@{ k = [DateTime]::Now }', '@{ k = 1 + 2 }',
        'a& echo VMSS_ARG_MARKER & rem ignore', 'a`& echo VMSS_ARG_MARKER & rem ignore',
        '``; Get-Date', ';true', '|false', '>true', 'value > ignored.txt', '--% literal', "value\nnext", "'unfinished"]) {
        it(`rejects unsafe decoded syntax before script invocation: ${JSON.stringify(args)}`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const source = scripts();
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-rejection-test-'));
            let invoker: WindowsInvokerInfo;
            try {
                invoker = prepareWindowsInvoker(source, 'deploy.ps1', args);
                const result = nativeRun(invoker, root);
                assert.ifError(result.error);
                assert.notStrictEqual(result.status, 0);
                assert(result.stderr.includes('Custom script arguments must contain only literal values.'), result.stderr);
                assert(!result.stdout.includes('TRUSTED_SCRIPT_RAN'));
                assert(!/^VMSS_ARG_MARKER(?:\s+`)?\s*$/m.test(result.stdout));
                assert(!fs.existsSync(path.join(root, invoker.blobsPrefixPath, 'scripts', 'ignored.txt')));
            } finally {
                if (invoker) {
                    fs.rmSync(invoker.localDirPath, { recursive: true });
                }
                fs.rmSync(root, { recursive: true });
                fs.rmSync(source, { recursive: true });
            }
        });
    }
    for (const script of ['..\\outside.ps1', 'C:\\outside.ps1', 'deploy.cmd', 'deploy.ps1:stream']) {
        it(`rejects an unsupported script path before staging: ${script}`, () => {
            assert.throws(() => prepareWindowsInvoker('', script, ''), /InvalidWindowsCustomScript|relative .ps1/);
        });
    }
    it('enforces the exact UTF-8 payload-size boundary', () => {
        const source = scripts();
        let invoker: WindowsInvokerInfo;
        try {
            const overhead = Buffer.byteLength(JSON.stringify({ version: 1, script: 'deploy.ps1', scriptArgs: '', archived: false }), 'utf8');
            const args = 'x'.repeat(WindowsInvokerPayloadLimit - overhead);
            invoker = prepareWindowsInvoker(source, 'deploy.ps1', args);
            assert.strictEqual(fs.statSync(path.join(invoker.localDirPath, WindowsInvokerPayloadFileName)).size, WindowsInvokerPayloadLimit);
            assert.throws(() => prepareWindowsInvoker(source, 'deploy.ps1', args + 'x'), /WindowsScriptPayloadTooLarge|1 MiB/);
        } finally {
            if (invoker) {
                fs.rmSync(invoker.localDirPath, { recursive: true });
            }
            fs.rmSync(source, { recursive: true });
        }
    });
    it('executes the archived package without overwriting bootstrap or payload', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        const source = scripts();
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-archive-test-'));
        const archive = path.join(root, 'archive & %VMSS_LITERAL% !.zip');
        let invoker: WindowsInvokerInfo;
        try {
            fs.writeFileSync(path.join(source, WindowsInvokerPayloadFileName), 'a script-package file, not the protocol payload');
            fs.writeFileSync(path.join(source, 'vmssDataInvoker.ps1'), 'a script-package file, not the bootstrap');
            const archiveResult = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
                'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:VMSS_ZIP_SOURCE, $env:VMSS_ZIP_PATH)'],
                { encoding: 'utf8', timeout: 15000, env: { ...process.env, VMSS_ZIP_SOURCE: source, VMSS_ZIP_PATH: archive } });
            assert.ifError(archiveResult.error);
            assert.strictEqual(archiveResult.status, 0, archiveResult.stderr);
            invoker = prepareWindowsInvoker(source, 'deploy.ps1', '@{ k = 1 }', archive);
            assert(!invoker.command.includes('archive &'));
            const result = nativeRun(invoker, root);
            assert.ifError(result.error);
            assert.strictEqual(result.status, 0, result.stderr);
            assert(result.stdout.includes('TRUSTED_SCRIPT_RAN'));
            const resultPath = path.join(root, invoker.blobsPrefixPath, 'scripts', 'result.json');
            assert.deepStrictEqual(JSON.parse(fs.readFileSync(resultPath, 'utf8')).Value, { k: 1 });
        } finally {
            if (invoker) {
                fs.rmSync(invoker.localDirPath, { recursive: true });
            }
            fs.rmSync(root, { recursive: true });
            fs.rmSync(source, { recursive: true });
        }
    });
    for (const body of ["throw 'TRUSTED_FAILURE'", 'exit 7']) {
        it(`preserves the selected script failure: ${body}`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const source = scripts('deploy.ps1', body);
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-exit-test-'));
            let invoker: WindowsInvokerInfo;
            try {
                invoker = prepareWindowsInvoker(source, 'deploy.ps1', '');
                const result = nativeRun(invoker, root);
                assert.ifError(result.error);
                assert.strictEqual(result.status, body.startsWith('exit') ? 7 : 1, result.stderr);
                if (body.startsWith('throw')) {
                    assert(result.stderr.includes('TRUSTED_FAILURE'));
                }
            } finally {
                if (invoker) {
                    fs.rmSync(invoker.localDirPath, { recursive: true });
                }
                fs.rmSync(root, { recursive: true });
                fs.rmSync(source, { recursive: true });
            }
        });
    }
    for (const script of ['..\\outside.ps1', 'C:\\outside.ps1', 'deploy.cmd', 'deploy.ps1:stream']) {
        it(`rejects an altered target-side script selection: ${script}`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const source = scripts();
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-target-path-test-'));
            let invoker: WindowsInvokerInfo;
            try {
                invoker = prepareWindowsInvoker(source, 'deploy.ps1', '');
                const payloadPath = path.join(invoker.localDirPath, WindowsInvokerPayloadFileName);
                const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
                payload.script = script;
                fs.writeFileSync(payloadPath, JSON.stringify(payload));
                const result = nativeRun(invoker, root);
                assert.ifError(result.error);
                assert.notStrictEqual(result.status, 0);
                assert(result.stderr.includes('relative .ps1 file'), result.stderr);
                assert(!result.stdout.includes('TRUSTED_SCRIPT_RAN'));
            } finally {
                if (invoker) {
                    fs.rmSync(invoker.localDirPath, { recursive: true });
                }
                fs.rmSync(root, { recursive: true });
                fs.rmSync(source, { recursive: true });
            }
        });
    }
    for (const data of ['{', 'null', '{"version":2,"script":"deploy.ps1","scriptArgs":"","archived":false}',
        '{"version":1,"script":"deploy.ps1","scriptArgs":[],"archived":false}', 'x'.repeat(WindowsInvokerPayloadLimit + 1)]) {
        it(`fails closed for corrupt or unsupported payload: ${data.length} bytes`, function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const source = scripts();
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-payload-test-'));
            let invoker: WindowsInvokerInfo;
            try {
                invoker = prepareWindowsInvoker(source, 'deploy.ps1', '');
                fs.writeFileSync(path.join(invoker.localDirPath, WindowsInvokerPayloadFileName), data);
                const result = nativeRun(invoker, root);
                assert.ifError(result.error);
                assert.notStrictEqual(result.status, 0);
                assert(result.stderr.includes('Invalid Windows custom script payload.'), result.stderr);
                assert(!result.stdout.includes('TRUSTED_SCRIPT_RAN'));
            } finally {
                if (invoker) {
                    fs.rmSync(invoker.localDirPath, { recursive: true });
                }
                fs.rmSync(root, { recursive: true });
                fs.rmSync(source, { recursive: true });
            }
        });
    }

    for (const oldState of ['true', 'false']) {
        for (const fixState of ['true', 'false', 'missing']) {
            it(`wires the full task protocol and protected settings: old=${oldState}, new=${fixState}`, async () => {
                const source = scripts();
                const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vmss-task-protocol-'));
                try {
                    process.env['_dataProtocolScripts_'] = source;
                    const protectedMode = oldState === 'true' && fixState === 'true';
                    const args = protectedMode ? 'a`& echo VMSS_ARG_MARKER `& rem ignore' : 'plain';
                    process.env['_dataProtocolArgs_'] = args;
                    process.env['_protocolOldFlag_'] = oldState;
                    process.env['_protocolFixFlag_'] = fixState;
                    process.env['_protocolActivate_'] = 'false';
                    process.env['_uploadCaptureRoot_'] = root;
                    process.env['existingExtensionName'] = 'extensionNameTest';
                    const runner = new ttm.MockTestRunner(path.join(__dirname, 'updateImageOnWindowsAgent.js'));
                    await runner.runAsync();
                    assert(runner.succeeded, runner.stdout + runner.stderr);
                    const line = runner.stdout.split(/\r?\n/).find(value => value.startsWith('##vso[task.debug]Invoker command: '));
                    assert(line);
                    const command = commandFromString(line).message.substring('Invoker command: '.length);
                    assert.strictEqual(command.includes('vmssDataInvoker.ps1'), protectedMode);
                    const extension = JSON.parse(fs.readFileSync(path.join(root, 'extension.json'), 'utf8'));
                    if (protectedMode) {
                        assert.strictEqual(extension.settings.commandToExecute, undefined);
                        assert.strictEqual(extension.settings.fileUris, undefined);
                        assert.strictEqual(extension.protectedSettings.commandToExecute, command);
                        assert(Array.isArray(extension.protectedSettings.fileUris));
                        const staged = JSON.parse(fs.readFileSync(path.join(root, 'staging.json'), 'utf8'));
                        assert(!fs.existsSync(staged.source), 'agent staging must be cleaned after upload');
                        const payload = JSON.parse(fs.readFileSync(path.join(root, staged.prefix, WindowsInvokerPayloadFileName), 'utf8'));
                        assert.strictEqual(payload.scriptArgs, args, 'the task must transport the original argument data');
                        if (process.platform === 'win32') {
                            const result = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', timeout: 15000 });
                            assert.ifError(result.error);
                            assert.strictEqual(result.status, 0, result.stderr);
                            assert(result.stdout.includes('TRUSTED_SCRIPT_RAN'));
                            assert(!/^VMSS_ARG_MARKER(?:\s+`)?\s*$/m.test(result.stdout));
                        }
                    } else {
                        assert.strictEqual(extension.settings.commandToExecute, command);
                    }
                } finally {
                    fs.rmSync(root, { recursive: true });
                    fs.rmSync(source, { recursive: true });
                }
            });
        }
    }
});
