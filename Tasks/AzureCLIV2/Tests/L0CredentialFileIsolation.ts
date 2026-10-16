import assert = require('assert');
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as tl from 'azure-pipelines-task-lib/task';
import { createServicePrincipalCertificate, removeServicePrincipalCertificate } from '../src/AzureCliCredentialFile';

const featureName = 'AzureCLICredentialFileIsolationEnabled';
const featureEnvironment = 'DISTRIBUTEDTASK_TASKS_AZURECLICREDENTIALFILEISOLATIONENABLED';

// Load the compiled production module with local mocks, without changing require's
// global cache or allowing the task's automatic runMain to touch the real agent.
function loadModule(file: string, mocks: { [name: string]: any }, platform = process.platform): any {
    const module: any = { exports: {} };
    module.exports = new Proxy(module.exports, {
        set: (target, name, value) => {
            if (name === 'azureclitask' && value) {
                const runMain = value.runMain;
                value.runMain = function (...args: any[]) {
                    const completion = runMain.apply(this, args);
                    target.completion = completion;
                    // The entry point invokes runMain without awaiting it. Capture its
                    // rejection immediately, then let the test await the original promise.
                    completion.catch(() => {});
                    return completion;
                };
            }
            return Reflect.set(target, name, value);
        }
    });
    const load = (name: string) => {
        assert(Object.prototype.hasOwnProperty.call(mocks, name), `Unexpected dependency: ${name}`);
        return mocks[name];
    };
    const wrapper = vm.runInThisContext(
        `(function(require, module, exports, __dirname, process) { ${fs.readFileSync(file, 'utf8')}\n})`,
        { filename: file });
    wrapper(load, module, module.exports, path.dirname(file),
        { version: process.version, platform, env: { ...process.env } });
    return module.exports;
}

export function runCredentialFileIsolationTests() {
    describe('Service-principal certificate helper', () => {
        let agentTemp: string;

        beforeEach(() => {
            agentTemp = fs.mkdtempSync(path.join(__dirname, '.credential-tests-'));
        });

        afterEach(() => {
            fs.rmSync(agentTemp, { recursive: true, force: true });
        });

        const loadHelper = (fileSystem: any, taskLib: any = tl, platform = process.platform) =>
            loadModule(path.join(__dirname, '..', 'src', 'AzureCliCredentialFile.js'), {
                fs: fileSystem,
                path,
                'azure-pipelines-task-lib/task': taskLib
            }, platform);

        it('creates unique credentials without overwriting or deleting a pre-existing root PEM', () => {
            const oldCertificate = path.join(agentTemp, 'spnCert.pem');
            fs.writeFileSync(oldCertificate, 'pre-existing certificate');
            const first = createServicePrincipalCertificate(agentTemp, 'first certificate');
            const second = createServicePrincipalCertificate(agentTemp, 'second certificate');
            assert.notStrictEqual(first.directoryPath, second.directoryPath);
            assert.notStrictEqual(first.certificatePath, second.certificatePath);
            for (const certificate of [first, second]) {
                assert.strictEqual(path.dirname(certificate.directoryPath), agentTemp);
                assert(path.basename(certificate.directoryPath).startsWith('.azclitask-credentials-'));
                assert.strictEqual(certificate.certificatePath, path.join(certificate.directoryPath, 'spnCert.pem'));
            }
            assert.strictEqual(fs.readFileSync(first.certificatePath, 'utf8'), 'first certificate');
            assert.strictEqual(fs.readFileSync(second.certificatePath, 'utf8'), 'second certificate');
            removeServicePrincipalCertificate(first.certificatePath, first.directoryPath);
            assert(fs.existsSync(second.certificatePath), 'one invocation must not delete another');
            removeServicePrincipalCertificate(second.certificatePath, second.directoryPath);
            assert.strictEqual(fs.readFileSync(oldCertificate, 'utf8'), 'pre-existing certificate');
        });

        it('writes exclusively with wx, UTF-8 and mode 0600', () => {
            let options: any;
            const helper = loadHelper({
                ...fs,
                writeFileSync: (file: string, content: string, writeOptions: any) => {
                    options = writeOptions;
                    fs.writeFileSync(file, content, writeOptions);
                }
            });
            helper.createServicePrincipalCertificate(agentTemp, 'certificate');
            assert.deepStrictEqual(options, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        });

        it('does not overwrite an existing PEM when exclusive creation fails', () => {
            const directory = fs.mkdtempSync(path.join(agentTemp, '.azclitask-credentials-'));
            const certificate = path.join(directory, 'spnCert.pem');
            fs.writeFileSync(certificate, 'existing');
            const removed: string[] = [];
            const helper = loadHelper({ ...fs, mkdtempSync: () => directory }, {
                rmRF: (target: string) => {
                    assert.strictEqual(fs.readFileSync(certificate, 'utf8'), 'existing');
                    removed.push(target);
                    tl.rmRF(target);
                }
            });
            assert.throws(() => helper.createServicePrincipalCertificate(agentTemp, 'replacement'), /EEXIST/);
            assert.deepStrictEqual(removed, [directory]);
        });

        it('uses directory 0700 and file 0600 permissions on Unix', function () {
            if (process.platform === 'win32') {
                this.skip();
            }
            const certificate = createServicePrincipalCertificate(agentTemp, 'certificate');
            assert.strictEqual(fs.statSync(certificate.directoryPath).mode & 0o777, 0o700);
            assert.strictEqual(fs.statSync(certificate.certificatePath).mode & 0o777, 0o600);
        });

        for (const operation of ['write', 'chmod']) {
            it(`removes the allocated directory and preserves the original ${operation} failure`, () => {
                const failure = new Error(`${operation} failed`);
                let directory: string;
                const helper = loadHelper({
                    ...fs,
                    mkdtempSync: (prefix: string) => {
                        directory = fs.mkdtempSync(prefix);
                        return directory;
                    },
                    chmodSync: (target: string, mode: number) => {
                        assert.strictEqual(mode, 0o700);
                        if (operation === 'chmod') {
                            throw failure;
                        }
                        fs.chmodSync(target, mode);
                    },
                    writeFileSync: (target: string, content: string, options: any) => {
                        fs.writeFileSync(target, content, options);
                        throw failure;
                    }
                }, tl, 'linux');
                assert.throws(() => helper.createServicePrincipalCertificate(agentTemp, 'certificate'),
                    (error: Error) => error === failure);
                assert(directory, 'the test must reach directory allocation');
                assert(!fs.existsSync(directory), 'even a partially written certificate must be removed');
            });
        }

        it('rejects an absent Agent.TempDirectory before allocating any credentials', () => {
            const helper = loadHelper({
                ...fs,
                mkdtempSync: () => { throw new Error('must not allocate'); }
            });
            for (const missing of [undefined, null, '']) {
                assert.throws(() => helper.createServicePrincipalCertificate(missing, 'certificate'),
                    /Agent.TempDirectory is required/);
            }
        });

        it('cleans the whole isolated directory, including additional files', () => {
            const certificate = createServicePrincipalCertificate(agentTemp, 'certificate');
            fs.mkdirSync(path.join(certificate.directoryPath, 'nested'));
            fs.writeFileSync(path.join(certificate.directoryPath, 'nested', 'other'), 'leftover');
            removeServicePrincipalCertificate(certificate.certificatePath, certificate.directoryPath);
            assert(!fs.existsSync(certificate.directoryPath));
            assert(fs.existsSync(agentTemp), 'cleanup must not remove the agent temp root');
        });

        it('removes only the certificate in legacy mode', () => {
            const certificate = path.join(agentTemp, 'spnCert.pem');
            const sibling = path.join(agentTemp, 'unrelated');
            fs.writeFileSync(certificate, 'certificate');
            fs.writeFileSync(sibling, 'keep');
            removeServicePrincipalCertificate(certificate);
            assert(!fs.existsSync(certificate));
            assert.strictEqual(fs.readFileSync(sibling, 'utf8'), 'keep');
        });

        it('safely accepts null, empty and nonexistent cleanup paths', () => {
            for (const missing of [undefined, null, '']) {
                assert.doesNotThrow(() => removeServicePrincipalCertificate(missing, missing));
            }
            assert.doesNotThrow(() => removeServicePrincipalCertificate(path.join(agentTemp, 'absent.pem')));
            assert.doesNotThrow(() => removeServicePrincipalCertificate(null, path.join(agentTemp, 'absent-dir')));
            assert(fs.existsSync(agentTemp));
        });

        it('warns without throwing or exposing certificate content when cleanup fails', () => {
            const warnings: string[] = [];
            const targets: string[] = [];
            const helper = loadHelper(fs, {
                rmRF: (target: string) => {
                    targets.push(target);
                    throw new Error('sensitive certificate content');
                },
                warning: (message: string) => warnings.push(message)
            });
            assert.doesNotThrow(() => helper.removeServicePrincipalCertificate('cert.pem', 'private-dir'));
            assert.doesNotThrow(() => helper.removeServicePrincipalCertificate('legacy.pem'));
            assert.deepStrictEqual(targets, ['private-dir', 'legacy.pem']);
            assert.strictEqual(warnings.length, 2);
            assert(warnings.every(message => /certificate/i.test(message)));
            assert(warnings.every(message => !message.includes('sensitive certificate content')));
        });
    });

    describe('Service-principal certificate task feature gate', () => {
        let previousFeature: string;

        beforeEach(() => {
            previousFeature = process.env[featureEnvironment];
        });

        afterEach(() => {
            if (previousFeature === undefined) {
                delete process.env[featureEnvironment];
            } else {
                process.env[featureEnvironment] = previousFeature;
            }
        });

        const scenarios: Array<{
            failure: string;
            flipAt?: string;
            cleanupFails?: boolean;
            missingTemp?: boolean;
            refreshLogin?: boolean;
        }> = [
            { failure: 'none' },
            { failure: 'login' },
            { failure: 'script' },
            { failure: 'none', flipAt: 'login' },
            { failure: 'none', flipAt: 'script' },
            { failure: 'none', cleanupFails: true },
            { failure: 'login', cleanupFails: true },
            { failure: 'script', cleanupFails: true },
            { failure: 'none', missingTemp: true },
            { failure: 'setupAfterLegacy' },
            { failure: 'none', flipAt: 'script', refreshLogin: true }
        ];
        for (const scenario of scenarios) {
            const { failure, flipAt, cleanupFails, missingTemp, refreshLogin } = scenario;
            it(`preserves positive flag creation and cleanup semantics: ${JSON.stringify(scenario)}`, async () => {
                const agentTemp = path.join(__dirname, 'agent temp');
                const workingDirectory = path.join(__dirname, 'working directory');
                const isolatedDirectory = path.join(agentTemp, '.azclitask-credentials-random');
                const isolatedPath = path.join(isolatedDirectory, 'spnCert.pem');
                const legacyPath = path.join(missingTemp ? workingDirectory : agentTemp, 'spnCert.pem');
                const commands: string[] = [];
                const writes: any[] = [];
                const creates: any[] = [];
                const removals: any[] = [];
                const features: string[] = [];
                const results: number[] = [];
                const events: string[] = [];
                const removedPaths: string[] = [];
                const warnings: string[] = [];
                const debugMessages: string[] = [];
                const cleanupError = new Error('credential cleanup failed');
                let runFlag: string;
                let task: any;
                const flipFeature = (phase: string) => {
                    if (flipAt === phase) {
                        process.env[featureEnvironment] = runFlag === 'true' ? 'false' : 'true';
                    }
                };
                const tool = {
                    arg: () => tool,
                    line: () => tool,
                    on: () => tool,
                    exec: async () => {
                        events.push('script');
                        flipFeature('script');
                        if (refreshLogin) {
                            await task.loginAzureRM('AzureRM');
                        }
                        if (failure === 'script') {
                            throw new Error('script failed');
                        }
                        return 0;
                    }
                };
                const scriptType = { getTool: async () => tool, cleanUp: async () => {} };
                const taskLib = {
                    debug: (message: string) => debugMessages.push(message),
                    warning: (message: string) => warnings.push(message),
                    error: () => {},
                    setSecret: () => {},
                    setResourcePath: () => {},
                    mkdirP: () => {},
                    cd: () => {},
                    rmRF: (target: string) => {
                        events.push('cleanup');
                        removedPaths.push(target);
                        if (cleanupFails) {
                            throw cleanupError;
                        }
                    },
                    getBoolFeatureFlag: () => false,
                    getPipelineFeature: (name: string) => {
                        features.push(name);
                        return name === featureName ? tl.getPipelineFeature(name) : false;
                    },
                    getInput: (name: string) => {
                        if (failure === 'setupAfterLegacy' && runFlag === 'true') {
                            throw new Error('setup failed before certificate creation');
                        }
                        return {
                            scriptLocation: 'scriptPath', scriptType: 'bash',
                            connectedServiceNameARM: 'AzureRM', connectionType: 'azureRM'
                        }[name] || '';
                    },
                    getBoolInput: (name: string) => name === 'useGlobalConfig' || name === 'visibleAzLogin',
                    getPathInput: () => path.join(agentTemp, 'script.sh'),
                    filePathSupplied: () => true,
                    getVariable: (name: string) => ({
                        'Agent.TempDirectory': missingTemp ? undefined : agentTemp,
                        'system.DefaultWorkingDirectory': workingDirectory
                    }[name]),
                    getEndpointAuthorizationScheme: () => 'ServicePrincipal',
                    getEndpointDataParameter: (_endpoint: string, name: string) => name === 'SubscriptionID' ? 'subId' : undefined,
                    getEndpointAuthorizationParameter: (_endpoint: string, name: string) => ({
                        authenticationType: 'spnCertificate', serviceprincipalid: 'spId',
                        tenantid: 'tenantId', servicePrincipalCertificate: 'CERTIFICATE'
                    }[name]),
                    which: (name: string) => name,
                    tool: () => tool,
                    execSync: (_command: string, args: string) => {
                        commands.push(args);
                        if (args.startsWith('login ')) {
                            flipFeature('login');
                        }
                        if (args.trim() === 'account clear') {
                            events.push('logout');
                        }
                        return {
                            code: failure === 'login' && args.startsWith('login ') ? 1 : 0,
                            stdout: 'azure-cli 2.66.0', stderr: ''
                        };
                    },
                    loc: (name: string) => name,
                    TaskResult: { Succeeded: 0, Failed: 1 },
                    IssueSource: {},
                    setResult: (result: number) => results.push(result)
                };
                const credentialHelper = loadModule(path.join(__dirname, '..', 'src', 'AzureCliCredentialFile.js'), {
                    fs, path, 'azure-pipelines-task-lib/task': taskLib
                });
                const mocks = {
                    path,
                    fs: { writeFileSync: (...args: any[]) => writes.push(args) },
                    os: { type: () => 'Linux' },
                    dns: { setDefaultResultOrder: () => {} },
                    net: { setDefaultAutoSelectFamily: () => {} },
                    'azure-pipelines-task-lib/task': taskLib,
                    'azure-devops-node-api': {},
                    'azure-pipelines-tasks-artifacts-common/webapi': {},
                    'azure-pipelines-tasks-artifacts-common/telemetry': {},
                    'azure-pipelines-tasks-azure-arm-rest/azCliUtility': { validateAzModuleVersion: async () => {} },
                    'azure-pipelines-tasks-args-sanitizer/argsSanitizer': {
                        tryValidateScriptArgs: () => {}, ArgsSanitizingError: class extends Error {}
                    },
                    './src/Utility': {
                        Utility: {
                            checkIfAzurePythonSdkIsInstalled: () => true,
                            throwIfError: (result: any) => { if (result.code !== 0) { throw result; } }
                        }
                    },
                    './src/ScriptType': {
                        ScriptTypeFactory: { getSriptType: () => scriptType, getScriptType: () => scriptType }
                    },
                    './src/AzureCliConfigDir': {},
                    './src/AzureCliCredentialFile': {
                        createServicePrincipalCertificate: (...args: any[]) => {
                            creates.push(args);
                            if (!args[0]) {
                                return credentialHelper.createServicePrincipalCertificate(args[0], args[1]);
                            }
                            return { certificatePath: isolatedPath, directoryPath: isolatedDirectory };
                        },
                        removeServicePrincipalCertificate: (...args: any[]) => {
                            removals.push(args);
                            credentialHelper.removeServicePrincipalCertificate(args[0], args[1]);
                        }
                    }
                };
                for (const flag of [undefined, 'true', 'false']) {
                    runFlag = flag;
                    if (flag === undefined) {
                        delete process.env[featureEnvironment];
                    } else {
                        process.env[featureEnvironment] = flag;
                    }
                    commands.length = writes.length = creates.length = removals.length = features.length = results.length = events.length = 0;
                    removedPaths.length = warnings.length = debugMessages.length = 0;
                    if (task && failure === 'setupAfterLegacy' && flag === 'true') {
                        assert.strictEqual(task.cliPasswordPath, legacyPath);
                        task.cliCredentialDirectory = path.join(agentTemp, 'stale-private-directory');
                    }
                    let completion: Promise<void>;
                    if (!task) {
                        const loaded = loadModule(path.join(__dirname, '..', 'azureclitask.js'), mocks);
                        task = loaded.azureclitask;
                        completion = loaded.completion;
                    } else {
                        completion = task.runMain();
                    }
                    const legacy = flag !== 'true';
                    if (legacy && cleanupFails) {
                        await assert.rejects(completion, (error: Error) => error === cleanupError);
                    } else {
                        await completion;
                    }
                    const expectedPath = legacy ? legacyPath : isolatedPath;
                    const setupFailure = failure === 'setupAfterLegacy' && !legacy;
                    const creationFailure = missingTemp && !legacy;
                    const noCertificate = setupFailure || creationFailure;
                    const loginCount = refreshLogin ? 2 : 1;
                    assert.strictEqual(features.filter(name => name === featureName).length, 1,
                        'read the canonical feature exactly once per invocation, including refreshed login and cleanup');
                    assert.deepStrictEqual(creates, legacy || setupFailure ? [] :
                        Array.from({ length: creationFailure ? 1 : loginCount },
                            () => [missingTemp ? undefined : agentTemp, 'CERTIFICATE']));
                    assert.deepStrictEqual(writes, legacy ?
                        Array.from({ length: loginCount }, () => [legacyPath, 'CERTIFICATE']) : []);
                    const passwordOption = path.basename(path.dirname(__dirname)).startsWith('AzureCLIV1')
                        ? `--password="${expectedPath}"` : `--certificate="${expectedPath}"`;
                    const logins = commands.filter(command => command.startsWith('login '));
                    assert.strictEqual(logins.length, noCertificate ? 0 : loginCount);
                    for (const login of logins) {
                        assert(login.includes(passwordOption), `login must use the selected certificate: ${login}`);
                        assert(login.includes('-u "spId"') && login.includes('--tenant "tenantId"'));
                    }
                    assert.deepStrictEqual(removals, legacy ? [] :
                        [[noCertificate ? null : isolatedPath, noCertificate ? null : isolatedDirectory]]);
                    assert.deepStrictEqual(removedPaths, noCertificate ? [] : [legacy ? legacyPath : isolatedDirectory]);
                    assert.strictEqual(debugMessages.includes('Removing spn certificate file'), legacy);
                    assert.strictEqual(task.cliPasswordPath, legacy ? legacyPath : null,
                        'only the enabled branch may clear the original certificate field');
                    assert.strictEqual(task.cliCredentialDirectory, null);
                    assert.strictEqual(warnings.length, !legacy && cleanupFails ? 1 : 0);
                    if (!legacy && cleanupFails) {
                        assert(/certificate/i.test(warnings[0]));
                    }
                    const expectedResult = noCertificate || failure === 'login' || failure === 'script' ? 1 : 0;
                    assert.deepStrictEqual(results, legacy && cleanupFails ? [] : [expectedResult],
                        'enabled cleanup must preserve the primary outcome; original cleanup failures still reject');
                    if (legacy && cleanupFails) {
                        assert(!events.includes('logout'), 'original cleanup failure interrupts the remaining finally block');
                    } else if (!noCertificate && failure !== 'login') {
                        assert(events.includes('script'));
                        assert(events.indexOf('logout') > events.indexOf('cleanup'), 'cleanup must not prevent logout');
                    } else {
                        assert(!events.includes('script'), 'setup, creation or login failure must not run the script');
                    }
                }
            });
        }
    });
}
