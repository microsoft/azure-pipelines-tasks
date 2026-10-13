import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as assert from 'assert';
import * as tl from 'azure-pipelines-task-lib/task';

// azure-arm-rest reads the agent temp directory when docker-common is loaded.
process.env['AGENT_TEMPDIRECTORY'] = process.env['AGENT_TEMPDIRECTORY'] || os.tmpdir();

import * as registryToken from 'azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken';
import Constants from '../constant';
import util from '../util';
import * as pushImage from '../pushimage';
import * as genConfig from '../genconfig';
import * as buildImage from '../buildimage';

const credentialVariable = Constants.fileNameDockerCredential;

function fakeToken(username: string, password: string, server: string): any {
    return {
        getUsername: () => username,
        getPassword: () => password,
        getLoginServerUrl: () => server
    };
}

function stub(target: any, saved: any, overrides: any): void {
    for (const key of Object.keys(overrides)) {
        saved[key] = target[key];
    }
    Object.assign(target, overrides);
}

// Runs fn while capturing stdout and returns the lines that set the credential variable.
async function captureCredentialCommands(fn: () => void | Promise<void>): Promise<string[]> {
    const originalWrite = process.stdout.write;
    let output = '';
    (process.stdout as any).write = (chunk: any) => { output += chunk.toString(); return true; };
    try {
        await fn();
    } finally {
        (process.stdout as any).write = originalWrite;
    }
    return output.split(os.EOL).filter(line => line.indexOf(`##vso[task.setvariable variable=${credentialVariable};`) >= 0);
}

function resetCredentialVariable(): void {
    tl.setVariable(credentialVariable, '', false);
}

describe('AzureIoTEdgeV2 docker credentials', function () {
    beforeEach(() => resetCredentialVariable());
    after(() => resetCredentialVariable());

    it('stores the credential list as a single-line secret variable', async () => {
        const password = 'pa\r\nss%word';
        const lines = await captureCredentialCommands(() => {
            util.createOrAppendDockerCredentials(fakeToken('user', password, 'contoso.azurecr.io'));
        });

        assert.strictEqual(lines.length, 1, 'expected exactly one setvariable command');
        assert.ok(lines[0].indexOf('issecret=true;') >= 0, 'credential variable should be secret');
        assert.ok(lines[0].indexOf(password) < 0, 'password should not appear raw in the command');
        assert.deepStrictEqual(util.readDockerCredentials(), [{ username: 'user', password: password, address: 'contoso.azurecr.io' }]);
    });

    it('appends to existing credentials and keeps the variable secret', async () => {
        await captureCredentialCommands(() => util.createOrAppendDockerCredentials(fakeToken('a', 'p1', 'one.azurecr.io')));
        const lines = await captureCredentialCommands(() => {
            util.createOrAppendDockerCredentials(fakeToken('b', 'p2', 'two.azurecr.io'));
        });

        assert.strictEqual(lines.length, 1);
        assert.ok(lines[0].indexOf('issecret=true;') >= 0);
        assert.deepStrictEqual(util.readDockerCredentials().map(c => c.address), ['one.azurecr.io', 'two.azurecr.io']);
    });
});

describe('AzureIoTEdgeV2 push', function () {
    const registryEnv = Object.keys(Constants.iotedgedevEnv).map(k => (Constants.iotedgedevEnv as any)[k]);
    let tempDir = '';
    let fillRegistryCredential = false;
    let storeCalls = 0;
    const originals: { tl: any, util: any, registryToken: any } = { tl: {}, util: {}, registryToken: {} };

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'AzureIoTEdgeV2-push-'));
        const templatePath = path.join(tempDir, 'deployment.template.json');
        fs.writeFileSync(templatePath, '{}');
        storeCalls = 0;
        resetCredentialVariable();

        const inputs: { [key: string]: string } = {
            containerregistrytype: 'Generic Container Registry',
            dockerRegistryEndpoint: 'registry',
            bypassModules: '',
            defaultPlatform: 'amd64'
        };
        stub(tl, originals.tl, {
            getInput: (name: string) => inputs[name],
            getPathInput: () => templatePath,
            getBoolInput: (name: string) => name === 'fillRegistryCredential' ? fillRegistryCredential : false,
            exec: () => Promise.resolve(0)
        });
        stub(registryToken, originals.registryToken, {
            getDockerRegistryEndpointAuthenticationToken: () => Promise.resolve(fakeToken('user', 'secret', 'contoso.azurecr.io'))
        });
        const store = util.createOrAppendDockerCredentials;
        stub(util, originals.util, {
            setTaskRootPath: () => { },
            setupIotedgedev: () => { },
            dockerLogin: () => ({ code: 0, stdout: '', stderr: '' }),
            dockerLogout: () => ({ code: 0, stdout: '', stderr: '' }),
            createOrAppendDockerCredentials: (token: any) => { storeCalls++; store.call(util, token); }
        });
    });

    afterEach(() => {
        Object.assign(tl, originals.tl);
        Object.assign(util, originals.util);
        Object.assign(registryToken, originals.registryToken);
        registryEnv.forEach(name => delete process.env[name]);
        resetCredentialVariable();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('does not store the registry credential when fillRegistryCredential is false', async () => {
        fillRegistryCredential = false;
        const lines = await captureCredentialCommands(() => pushImage.run());

        assert.strictEqual(storeCalls, 0, 'credential store should be skipped');
        assert.strictEqual(lines.length, 0, 'credential variable should not be set');
        assert.deepStrictEqual(util.readDockerCredentials(), []);
    });

    it('stores the registry credential as a secret when fillRegistryCredential is true', async () => {
        fillRegistryCredential = true;
        const lines = await captureCredentialCommands(() => pushImage.run());

        assert.strictEqual(storeCalls, 1);
        assert.strictEqual(lines.length, 1);
        assert.ok(lines[0].indexOf('issecret=true;') >= 0);
        assert.deepStrictEqual(util.readDockerCredentials(), [{ username: 'user', password: 'secret', address: 'contoso.azurecr.io' }]);
    });
});

describe('AzureIoTEdgeV2 iotedgedev environment', function () {
    const registryEnv = Object.keys(Constants.iotedgedevEnv).map(k => (Constants.iotedgedevEnv as any)[k]);
    const secretValue = 'vault-only-value';
    let tempDir = '';
    let templatePath = '';
    let warnings: string[] = [];
    let execEnvs: NodeJS.ProcessEnv[] = [];
    let savedEnv: { [key: string]: string | undefined } = {};
    const originals: { tl: any, util: any, registryToken: any } = { tl: {}, util: {}, registryToken: {} };

    beforeEach(() => {
        const touchedEnv = registryEnv.concat(['MY_SECRET', 'MAPPED_SECRET', Constants.outputVariableDeploymentPathKey, '_' + Constants.outputVariableDeploymentPathKey]);
        savedEnv = {};
        touchedEnv.forEach(name => savedEnv[name] = process.env[name]);
        delete process.env['MY_SECRET'];
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'AzureIoTEdgeV2-env-'));
        templatePath = path.join(tempDir, 'deployment.template.json');
        fs.writeFileSync(templatePath, '{}');
        warnings = [];
        execEnvs = [];
        // Simulates a secret the owner mapped to this step with env:.
        process.env['MAPPED_SECRET'] = 'mapped-value';

        const inputs: { [key: string]: string } = {
            containerregistrytype: 'Generic Container Registry',
            dockerRegistryEndpoint: 'registry',
            bypassModules: '',
            defaultPlatform: 'amd64',
            deploymentManifestOutputPath: path.join(tempDir, 'deployment.json')
        };
        stub(tl, originals.tl, {
            getInput: (name: string) => inputs[name],
            getPathInput: () => templatePath,
            getBoolInput: () => false,
            getVariables: () => [{ name: 'my.secret', value: secretValue, secret: true }],
            warning: (message: string) => { warnings.push(message); },
            loc: (key: string, ...args: any[]) => [key].concat(args).join(' '),
            exec: (tool: string, args: any, options: any) => { execEnvs.push(Object.assign({}, options.env)); return Promise.resolve(0); }
        });
        stub(registryToken, originals.registryToken, {
            getDockerRegistryEndpointAuthenticationToken: () => Promise.resolve(fakeToken('user', 'secret', 'contoso.azurecr.io'))
        });
        stub(util, originals.util, {
            setTaskRootPath: () => { },
            setupIotedgedev: () => { },
            dockerLogin: () => ({ code: 0, stdout: '', stderr: '' }),
            dockerLogout: () => ({ code: 0, stdout: '', stderr: '' })
        });
    });

    afterEach(() => {
        Object.assign(tl, originals.tl);
        Object.assign(util, originals.util);
        Object.assign(registryToken, originals.registryToken);
        Object.keys(savedEnv).forEach(name => {
            if (savedEnv[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = savedEnv[name];
            }
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    [['genconfig', genConfig], ['build', buildImage], ['push', pushImage]].forEach(([name, command]: [string, any]) => {
        it(`${name} passes only mapped secrets to iotedgedev`, async () => {
            await command.run();

            assert.strictEqual(execEnvs.length, 1);
            assert.ok(Object.keys(execEnvs[0]).every(key => execEnvs[0][key] !== secretValue), 'unmapped secret should not reach iotedgedev');
            assert.strictEqual(execEnvs[0]['MAPPED_SECRET'], 'mapped-value');
        });
    });

    it('warns when the template uses an unmapped secret', async () => {
        fs.writeFileSync(templatePath, '{"password": "${MY_SECRET}"}');
        await genConfig.run();

        assert.deepStrictEqual(warnings, ['SecretVariableNotMapped my.secret MY_SECRET']);
        assert.ok(warnings.every(w => w.indexOf(secretValue) < 0));
    });

    it('does not warn when the secret is mapped', async () => {
        fs.writeFileSync(templatePath, '{"password": "${MY_SECRET}"}');
        process.env['MY_SECRET'] = 'mapped';
        await genConfig.run();

        assert.deepStrictEqual(warnings, []);
    });

    it('does not warn for a longer name sharing the prefix', async () => {
        fs.writeFileSync(templatePath, '{"other": "${MY_SECRETS}"}');
        await genConfig.run();

        assert.deepStrictEqual(warnings, []);
    });

    it('does not warn for an unclosed placeholder', async () => {
        fs.writeFileSync(templatePath, '{"other": "${MY_SECRET-X}"}');
        await genConfig.run();

        assert.deepStrictEqual(warnings, []);
    });
});

describe('AzureIoTEdgeV2 task manifest', function () {
    const expectedAllowed = ['DOCKER_CLI_EXPERIMENTAL', 'DEPLOYMENT_FILE_PATH', '_DEPLOYMENT_FILE_PATH', 'VSTS_EXTENSION_EDGE_DOCKER_CREDENTIAL'];

    ['task.json', 'task.loc.json'].forEach(file => {
        it(`${file} restricts commands and settable variables`, () => {
            const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
            const restrictions = manifest.restrictions;

            assert.ok(restrictions, 'restrictions should be declared');
            assert.strictEqual(restrictions.commands.mode, 'restricted');
            assert.deepStrictEqual(restrictions.settableVariables.allowed.slice().sort(), expectedAllowed.slice().sort());
        });
    });
});
