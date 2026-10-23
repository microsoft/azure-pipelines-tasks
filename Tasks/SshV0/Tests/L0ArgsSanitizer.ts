import assert = require('assert');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');

import { validateScriptArgs } from '../argsSanitizer';

function clearFlags(): void {
    delete process.env['AZP_75787_ENABLE_NEW_LOGIC'];
    delete process.env['AZP_75787_ENABLE_NEW_LOGIC_LOG'];
    delete process.env['AZP_75787_ENABLE_COLLECT'];
}

describe('SshV0 argsSanitizer Suite', function () {
    before(() => {
        tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
    });

    afterEach(() => {
        clearFlags();
    });

    it('does nothing when the org validation flag is off (default)', () => {
        clearFlags();
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG\\; echo INJECTED', 'powershell'));
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG\\; echo INJECTED', 'bash'));
    });

    it('blocks a direct semicolon for bash (baseline, unchanged)', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('SAFE_ARG; echo INJECTED', 'bash'));
    });

    it('blocks a direct semicolon for PowerShell', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('SAFE_ARG; echo INJECTED', 'powershell'));
    });

    it('allows a single-backslash-escaped semicolon for bash (correct - bash itself neutralizes it)', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG\\; echo INJECTED', 'bash'));
    });

    it('MSRC 157502 fix: blocks a single-backslash-escaped semicolon for PowerShell', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('SAFE_ARG\\; echo INJECTED', 'powershell'));
    });

    it('defaults to bash rules when targetShellType is not provided', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG\\; echo INJECTED', ''));
    });

    it('still allows a legitimate backslash-escaped wildcard for bash', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('--files=\\*.log', 'bash'));
    });

    it('allows a legitimate backtick-escaped semicolon for PowerShell', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG`;still_one_token', 'powershell'));
    });

    it('PowerShell allow-list matches bash plus backtick - wildcard/array/percent chars now need escaping', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('--files=*.log', 'powershell'));
        assert.throws(() => validateScriptArgs('-Items 1,2,3', 'powershell'));
        assert.throws(() => validateScriptArgs('-Count 10+5', 'powershell'));
        assert.throws(() => validateScriptArgs('~\\Documents', 'powershell'));
        assert.doesNotThrow(() => validateScriptArgs('--files=`*.log', 'powershell'));
        assert.doesNotThrow(() => validateScriptArgs('-Items 1`,2`,3', 'powershell'));
    });

    it('still blocks PowerShell execution primitives even when backslash-escaped', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('SAFE_ARG\\$(whoami)', 'powershell'));
        assert.throws(() => validateScriptArgs('SAFE_ARG\\&echo INJECTED', 'powershell'));
        assert.throws(() => validateScriptArgs('SAFE_ARG\\|echo INJECTED', 'powershell'));
    });

    it('audit mode warns but does not throw', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC_LOG'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG; echo INJECTED', 'powershell'));
    });

    it('cmd: blocks a direct ampersand', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('SAFE_ARG& echo INJECTED', 'cmd'));
    });

    it('cmd: allows a caret-escaped ampersand (caret is the trusted escape symbol, like backslash/backtick for bash/PowerShell)', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG^& echo INJECTED', 'cmd'));
    });

    it('cmd: blocks unescaped pipe, redirection, parentheses, and $(', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('SAFE_ARG| findstr x', 'cmd'));
        assert.throws(() => validateScriptArgs('SAFE_ARG> out.txt', 'cmd'));
        assert.throws(() => validateScriptArgs('(SAFE_ARG)', 'cmd'));
        assert.throws(() => validateScriptArgs('SAFE_ARG$(whoami)', 'cmd'));
    });

    it('cmd: allows the same characters once caret-escaped', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG^| findstr x', 'cmd'));
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG^> out.txt', 'cmd'));
        assert.doesNotThrow(() => validateScriptArgs('^(SAFE_ARG^)', 'cmd'));
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG^$^(whoami^)', 'cmd'));
    });

    it('cmd: blocks a bare percent, allows it once caret-escaped on both sides (same rule as every other character)', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.throws(() => validateScriptArgs('SAFE_ARG%VAR%', 'cmd'));
        assert.throws(() => validateScriptArgs('SAFE_ARG^%VAR%', 'cmd'));
        assert.doesNotThrow(() => validateScriptArgs('SAFE_ARG^%VAR^%', 'cmd'));
    });

    it('cmd: allows normal arguments (letters, numbers, paths with backslash, quoted values)', () => {
        process.env['AZP_75787_ENABLE_NEW_LOGIC'] = 'true';
        assert.doesNotThrow(() => validateScriptArgs('--name="John Doe" -Path=C:/folder/file.txt', 'cmd'));
        assert.doesNotThrow(() => validateScriptArgs('-Path=C:\\folder\\file.txt', 'cmd'));
    });
});
