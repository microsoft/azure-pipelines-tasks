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
        let realExecSync: typeof tl.execSync;
        let originalAgentTemp: string | undefined;

        beforeEach(() => {
            agentTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'bicepdeploy-agenttmp-'));
            realExecSync = tl.execSync;
            originalAgentTemp = process.env['AGENT_TEMPDIRECTORY'];
            process.env['AGENT_TEMPDIRECTORY'] = agentTemp;
        });

        afterEach(() => {
            (tl as any).execSync = realExecSync;
            if (originalAgentTemp === undefined) {
                delete process.env['AGENT_TEMPDIRECTORY'];
            } else {
                process.env['AGENT_TEMPDIRECTORY'] = originalAgentTemp;
            }
            try { fs.rmSync(agentTemp, { recursive: true, force: true }); } catch { /* ignore */ }
            delete process.env['AZURE_CONFIG_DIR'];
        });

        function createLoginCredentials() {
            const directoryPath = fs.mkdtempSync(path.join(agentTemp, '.azarmrest-credentials-'));
            const certificatePath = path.join(directoryPath, 'spnCert.pem');
            fs.writeFileSync(certificatePath, 'test-certificate');
            return { certificatePath, directoryPath };
        }

        it('removes the isolated config dir and unsets the env var', () => {
            const helper: any = new AzureAuthenticationHelper();
            const dir = createPerInvocationAzureConfigDir(agentTemp);
            helper.azureConfigDir = dir;

            helper.logoutAzure();

            assert(!fs.existsSync(dir), 'config dir must be removed on logout');
            assert.strictEqual(helper.azureConfigDir, null, 'helper must clear its reference');
            assert.strictEqual(process.env['AZURE_CONFIG_DIR'], undefined);
        });

        it('removes login credential files after az logout and before the config dir', () => {
            const helper: any = new AzureAuthenticationHelper();
            const configDir = createPerInvocationAzureConfigDir(agentTemp);
            const credentials = createLoginCredentials();
            helper.azureConfigDir = configDir;
            helper.loginCredentials = credentials;
            helper.sessionLoggedIn = true;

            const observedDuringLogout: { credentialsPresent?: boolean, configDirPresent?: boolean } = {};
            (tl as any).execSync = (tool: string, args: string) => {
                assert.strictEqual(tool, 'az');
                assert.strictEqual(args, 'account clear');
                observedDuringLogout.credentialsPresent = fs.existsSync(credentials.certificatePath);
                observedDuringLogout.configDirPresent = fs.existsSync(configDir);
                return { code: 0, stdout: '', stderr: '' };
            };

            helper.logoutAzure();

            assert.strictEqual(observedDuringLogout.credentialsPresent, true, 'credential files must remain until az logout runs');
            assert.strictEqual(observedDuringLogout.configDirPresent, true, 'config dir must remain until az logout runs');
            assert(!fs.existsSync(credentials.directoryPath), 'credential directory must be removed after logout');
            assert(!fs.existsSync(configDir), 'config dir must be removed after logout');
            assert.strictEqual(helper.loginCredentials, undefined, 'helper must clear its credential reference');
        });

        it('removes login credential files and the config dir even when az logout fails', () => {
            const helper: any = new AzureAuthenticationHelper();
            const configDir = createPerInvocationAzureConfigDir(agentTemp);
            const credentials = createLoginCredentials();
            helper.azureConfigDir = configDir;
            helper.loginCredentials = credentials;
            helper.sessionLoggedIn = true;

            (tl as any).execSync = () => { throw new Error('simulated logout failure'); };

            assert.doesNotThrow(() => helper.logoutAzure(), 'logout failure must not fail the task');
            assert(!fs.existsSync(credentials.directoryPath), 'credential directory must be removed despite the failure');
            assert(!fs.existsSync(configDir), 'config dir must be removed despite the failure');
            assert.strictEqual(process.env['AZURE_CONFIG_DIR'], undefined);
        });

        it('is a no-op when isolation never ran', () => {
            const helper: any = new AzureAuthenticationHelper();
            assert.doesNotThrow(() => helper.logoutAzure());
            assert.strictEqual(helper.azureConfigDir, null);
            assert.strictEqual(helper.loginCredentials, undefined);
        });
    });
}
