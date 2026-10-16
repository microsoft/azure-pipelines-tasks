import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as fs from 'fs';
import * as path from 'path';
import os = require('os');

// Driven by L0.ts through NOTATION_L0_AUTH (spnCertificate | workloadidentityfederation),
// NOTATION_L0_TEMP (Agent.TempDirectory) and NOTATION_L0_SIGN_FAILS.
const authType = process.env['NOTATION_L0_AUTH'] || '';
const agentTemp = process.env['NOTATION_L0_TEMP'] || '';
const signFails = process.env['NOTATION_L0_SIGN_FAILS'] === 'true';
const connection = 'akv-service-connection';
const certificate = 'synthetic-certificate';
const oidcToken = 'synthetic-oidc-token';

let taskPath = path.join(__dirname, '..', 'src', 'index.js');
let tmr = new tmrm.TaskMockRunner(taskPath);

tmr.setAnswers({
    "which": {
        "notation": "notation"
    },
    "checkPath": {
        "notation": true
    },
    "exec": {
        "notation plugin list": {
            "code": 0,
            "stdout": "extracted"
        }
    },
})

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    downloadTool(url: string, filename: string): Promise<string> {
        return Promise.resolve('notation-azure-kv_1.0.0_linux_amd64.tar.gz');
    },
    extractTar(file: string, destination?: string | undefined): Promise<string> {
        return Promise.resolve('extracted');
    },
});

tmr.registerMock('./crypto', {
    computeChecksum: (filePath: string) => {
        return Promise.resolve('f8a75d9234db90069d9eb5660e5374820edf36d710bd063f4ef81e7063d3810b');
    }
})

tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: () => 'system-access-token'
});

tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => ({}),
    WebApi: class {
        async getTaskApi() {
            return {
                createOidcToken: async () => ({ oidcToken: oidcToken })
            };
        }
    }
});

// Inspects the credential file while `notation sign` would be running.
function checkCredentialFile(env: { [key: string]: string }): string {
    const expected = authType === 'spnCertificate'
        ? { file: env['AZURE_CLIENT_CERTIFICATE_PATH'], content: certificate }
        : { file: env['AZURE_FEDERATED_TOKEN_FILE'], content: oidcToken };
    if (!expected.file || !fs.existsSync(expected.file)) {
        return 'credential file does not exist';
    }
    if (fs.readFileSync(expected.file, 'utf8') !== expected.content) {
        return 'unexpected credential content';
    }

    const directory = path.dirname(expected.file);
    if (path.dirname(directory) !== path.resolve(agentTemp) || !path.basename(directory).startsWith('.notation-credentials-')) {
        return `credential file is not in an isolated directory: ${expected.file}`;
    }
    if (process.platform !== 'win32') {
        if ((fs.statSync(directory).mode & 0o777) !== 0o700 || (fs.statSync(expected.file).mode & 0o777) !== 0o600) {
            return 'credential file is not owner-only';
        }
    }
    return '';
}

tmr.registerMock('./lib/runner', {
    notationRunner: async (artifactRefs: string[], runCommand: (notation: any, artifactRef: string, execOptions: any) => Promise<number>) => {
        const notation: any = {
            arg: () => notation,
            argIf: () => notation,
            exec: async (execOptions: any) => {
                const problem = checkCredentialFile(execOptions.env);
                console.log(problem ? `CREDENTIAL_FILE_INVALID: ${problem}` : 'CREDENTIAL_FILE_VALID');
                return 0;
            }
        };
        for (const artifactRef of artifactRefs) {
            await runCommand(notation, artifactRef, {});
        }
        if (signFails) {
            throw new Error('synthetic signing failure');
        }
    }
});

os.platform = () => {
    return 'linux' as NodeJS.Platform;
}
os.arch = () => {
    return 'x64';
}
tmr.registerMock('os', os);

process.env['AGENT_TEMPDIRECTORY'] = agentTemp;
process.env['SYSTEM_JOBID'] = 'job-id';
process.env['SYSTEM_PLANID'] = 'plan-id';
process.env['SYSTEM_TEAMPROJECTID'] = 'project-id';
process.env['SYSTEM_HOSTTYPE'] = 'build';
process.env['SYSTEM_COLLECTIONURI'] = 'https://dev.azure.com/org/';
process.env[`ENDPOINT_AUTH_PARAMETER_${connection}_SERVICEPRINCIPALID`] = 'client-id';
process.env[`ENDPOINT_AUTH_PARAMETER_${connection}_TENANTID`] = 'tenant-id';
if (authType === 'spnCertificate') {
    process.env[`ENDPOINT_AUTH_SCHEME_${connection}`] = 'ServicePrincipal';
    process.env[`ENDPOINT_AUTH_PARAMETER_${connection}_AUTHENTICATIONTYPE`] = 'spnCertificate';
    process.env[`ENDPOINT_AUTH_PARAMETER_${connection}_SERVICEPRINCIPALCERTIFICATE`] = certificate;
} else {
    process.env[`ENDPOINT_AUTH_SCHEME_${connection}`] = 'WorkloadIdentityFederation';
}

tmr.setInput('command', 'sign');
tmr.setInput('akvPluginVersion', '1.0.1');
tmr.setInput('artifactRefs', 'localhost:5000/e2e@sha256:xxxxxx');
tmr.setInput('plugin', 'azureKeyVault');
tmr.setInput('azurekvServiceConection', connection);
tmr.setInput('keyid', 'https://xxx.vault.azure.net/keys/self-signed-cert/a12c1ba176df4476a9325ca48ff796ad')
tmr.setInput('selfSigned', 'true');

tmr.run();
