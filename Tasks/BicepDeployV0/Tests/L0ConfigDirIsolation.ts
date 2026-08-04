import assert = require('assert');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

import { createPerInvocationAzureConfigDir, removePerInvocationAzureConfigDir } from '../azureConfigDir';
import { AzureAuthenticationHelper } from '../auth';

export function runConfigDirIsolationTests() {
    describe('createPerInvocationAzureConfigDir (login-race hardening)', () => {
        let agentTemp: string;

        beforeEach(() => {
            agentTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'bicepdeploy-agenttmp-'));
        });

        afterEach(() => {
            try { fs.rmSync(agentTemp, { recursive: true, force: true }); } catch { /* ignore */ }
            delete process.env['AZURE_CONFIG_DIR'];
        });

        it('sets process.env.AZURE_CONFIG_DIR to the new directory', () => {
            delete process.env['AZURE_CONFIG_DIR'];
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            try {
                assert.strictEqual(process.env['AZURE_CONFIG_DIR'], dir,
                    'helper must set the env var so az / azure-arm-rest picks up the new dir');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
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

        it('uses the ".bicepdeploy-" prefix with a random suffix', () => {
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            try {
                assert(path.basename(dir).startsWith('.bicepdeploy-'),
                    `basename should start with ".bicepdeploy-" (got "${path.basename(dir)}")`);
                assert(path.basename(dir).length > '.bicepdeploy-'.length,
                    'mkdtemp must append a random suffix');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('produces a different directory on each invocation (per-invocation isolation)', () => {
            const a = createPerInvocationAzureConfigDir(agentTemp);
            const b = createPerInvocationAzureConfigDir(agentTemp);
            try {
                assert.notStrictEqual(a, b, 'two invocations must yield distinct dirs');
            } finally {
                fs.rmSync(a, { recursive: true, force: true });
                fs.rmSync(b, { recursive: true, force: true });
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
            agentTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'bicepdeploy-agenttmp-'));
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
            const ghost = path.join(agentTemp, '.bicepdeploy-ghost00');
            assert(!fs.existsSync(ghost));
            assert.doesNotThrow(() => removePerInvocationAzureConfigDir(ghost));
        });
    });

    describe('AzureAuthenticationHelper.logoutAzure cleanup guarantees', () => {
        let agentTemp: string;
        let realRmRF: typeof tl.rmRF;

        beforeEach(() => {
            agentTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'bicepdeploy-agenttmp-'));
            realRmRF = tl.rmRF;
        });

        afterEach(() => {
            (tl as any).rmRF = realRmRF;
            try { fs.rmSync(agentTemp, { recursive: true, force: true }); } catch { /* ignore */ }
            delete process.env['AZURE_CONFIG_DIR'];
        });

        it('removes the isolated config dir and unsets the env var', () => {
            const helper: any = new AzureAuthenticationHelper();
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            helper.azureConfigDir = dir;

            helper.logoutAzure();

            assert(!fs.existsSync(dir), 'config dir must be removed on logout');
            assert.strictEqual(helper.azureConfigDir, null, 'helper must clear its reference');
            assert.strictEqual(process.env['AZURE_CONFIG_DIR'], undefined);
        });

        // A throw from certificate cleanup must not strand the isolated config dir.
        it('removes the isolated config dir even when certificate cleanup fails', () => {
            const helper: any = new AzureAuthenticationHelper();
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            helper.azureConfigDir = dir;
            helper.cliPasswordPath = path.join(agentTemp, 'spnCert.pem');
            fs.writeFileSync(helper.cliPasswordPath, 'cert');

            // Throw only for the certificate path -- removePerInvocationAzureConfigDir
            // calls tl.rmRF too, so a blanket stub would sabotage the code under test.
            (tl as any).rmRF = (p: string) => {
                if (p === helper.cliPasswordPath) {
                    throw new Error('simulated certificate cleanup failure');
                }
                return realRmRF(p);
            };

            assert.doesNotThrow(() => helper.logoutAzure(),
                'certificate cleanup failure must not fail the task');
            assert(!fs.existsSync(dir), 'config dir must be removed despite the failure');
            assert.strictEqual(process.env['AZURE_CONFIG_DIR'], undefined);
        });

        it('is a no-op when isolation never ran', () => {
            const helper: any = new AzureAuthenticationHelper();
            assert.doesNotThrow(() => helper.logoutAzure());
            assert.strictEqual(helper.azureConfigDir, null);
        });
    });
}
