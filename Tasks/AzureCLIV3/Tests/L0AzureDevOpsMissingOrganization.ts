
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

// ---------- Centralized, overridable test inputs ----------
// Allow environment overrides to avoid hardcoded values.
const ORG_URL = process.env.TEST_ORG_URL || 'https://dev.azure.com/testorg/';
const PROJECT = process.env.TEST_PROJECT_NAME || 'TestProject';
const SP_ID = process.env.TEST_SP_ID || 'test-sp-id';
const TENANT_ID = process.env.TEST_TENANT_ID || 'test-tenant-id';

// Select shell & scriptType per platform
const isWindows = process.platform === 'win32';
const SHELL = isWindows ? 'pwsh' : 'bash';
const SCRIPT_TYPE = isWindows ? 'pscore' : 'bash';

const taskPath = path.join(__dirname, '..', 'azureclitask.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// ---------- Inputs ----------
tmr.setInput('connectionType', 'azureDevOps');
tmr.setInput('azureDevOpsServiceConnection', 'TestAzureDevOpsConnection');
tmr.setInput('scriptType', SCRIPT_TYPE);
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo "test"');
tmr.setInput('failOnStandardError', 'false');
tmr.setInput('visibleAzLogin', 'false');
tmr.setInput('useGlobalConfig', 'false');
tmr.setInput('cwd', __dirname);

// ---------- Env (no hardcoded values) ----------
process.env['ENDPOINT_AUTH_TestAzureDevOpsConnection'] = JSON.stringify({
    scheme: 'WorkloadIdentityFederation',
    parameters: {
        serviceprincipalid: SP_ID,
        tenantid: TENANT_ID
    }
});
process.env['ENDPOINT_AUTH_SCHEME_TestAzureDevOpsConnection'] = 'WorkloadIdentityFederation';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureDevOpsConnection_SERVICEPRINCIPALID'] = SP_ID;
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureDevOpsConnection_TENANTID'] = TENANT_ID;

process.env['ENDPOINT_DATA_TestAzureDevOpsConnection'] = JSON.stringify({
    organizationUrl: ORG_URL
});
process.env['ENDPOINT_URL_TestAzureDevOpsConnection'] = ORG_URL;

// Intentionally omit SYSTEM_COLLECTIONURI to trigger "skip organization configuration"
delete process.env['SYSTEM_COLLECTIONURI'];
process.env['SYSTEM_TEAMPROJECT'] = PROJECT;
process.env['SYSTEM_JOBID'] = 'test-job-id';
process.env['SYSTEM_PLANID'] = 'test-plan-id';
process.env['SYSTEM_TEAMPROJECTID'] = 'test-project-id';
process.env['SYSTEM_HOSTTYPE'] = 'build';
process.env['AGENT_TEMPDIRECTORY'] = __dirname;
process.env['AGENT_WORKFOLDER'] = __dirname;

process.env['AZP_AZURECLIV2_SETUP_PROXY_ENV'] = 'false';
process.env['ShowWarningOnOlderAzureModules'] = 'false';
process.env['UseAzVersion'] = 'false';

// ---------- Mock answers ----------
// Build commonly used commands dynamically to avoid hardcoding.
const azLoginCmd = `az login --service-principal -u "${SP_ID}" --tenant "${TENANT_ID}" --allow-no-subscriptions --federated-token "mock-token" --output none`;
const azVersionCmd = 'az version';
const azVersionLegacy = 'az --version';
const azExtShow = 'az extension show --name azure-devops';
const azExtInstall = 'az extension add -n azure-devops -y';
const azDevopsProjectConfigQuoted = `az devops configure --defaults project="${PROJECT}"`;

const mockAnswers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    which: {
        az: 'az',
        [SHELL]: SHELL
    },
    checkPath: {
        az: true,
        [SHELL]: true
    },
    exec: {
        [azVersionLegacy]: { code: 0, stdout: 'azure-cli 2.50.0' },
        [azVersionCmd]: { code: 0, stdout: '{"azure-cli": "2.50.0", "azure-cli-core": "2.50.0"}' },
        [azExtShow]: { code: 1, stdout: "Extension 'azure-devops' is not installed." },
        [azExtInstall]: { code: 0, stdout: 'Azure DevOps CLI extension installed' },

        // Login in WIF mode (SPN + federated token)
        [azLoginCmd]: { code: 0, stdout: 'Login successful' },

        // Configure project default (quoted variant)
        [azDevopsProjectConfigQuoted]: { code: 0, stdout: 'project configured' },

        // Fallback: clear defaults (used by some cleanup paths)
        'az devops configure --defaults project=\'\' organization=': { code: 0, stdout: 'configuration cleared' },

        // Generic fallbacks to keep the test runner resilient
        [`${SHELL}*`]: { code: 0, stdout: 'test completed' },
        '*': { code: 0, stdout: 'test completed' }
    },
    exists: {
        [SHELL]: true
    }
};

tmr.setAnswers(mockAnswers);

// ---------- Mocks for dependencies ----------
tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => ({}),
    WebApi: function () {
        return {
            getTaskApi: () => Promise.resolve({
                createOidcToken: () => Promise.resolve({ oidcToken: 'mock-token' })
            })
        };
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: () => 'system-token'
});

tmr.registerMock('./src/Utility', {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: function () {
            return true;
        },
        throwIfError: function (result: any, errormsg?: string) {
            if (result && result.code !== 0) {
                throw new Error(errormsg || 'Command failed');
            }
        },
        getScriptPath: function (scriptLocation: string, fileExtensions: string[]) {
            // Return a platform-appropriate script path without hardcoding
            const scriptName = isWindows ? 'test-script.ps1' : 'test-script.sh';
            return Promise.resolve(path.join(__dirname, scriptName));
        },
        getPowerShellScriptPath: function (scriptLocation: string, fileExtensions: string[], scriptArguments: string) {
            return Promise.resolve(path.join(__dirname, 'test-script.ps1'));
        },
        createFile: function (filePath: string, data: string, options?: any) {
            return Promise.resolve();
        },
        deleteFile: function (filePath: string) {
            return Promise.resolve();
        }
    }
});

// ScriptType mock stays OS-agnostic
tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getScriptType: function () {
            return {
                getTool: function () {
                    return Promise.resolve({
                        on: function (_event: string, _callback: Function) {
                            // No-op for event handlers
                        },
                        line: function (_args: string) {
                            // No-op for argument line
                        },
                        arg: function (_args: string) {
                            // No-op for arguments
                            return this;
                        },
                        exec: function (_options?: any) {
                            console.log('Mock script execution completed');
                            return Promise.resolve(0);
                        }
                    });
                },
                cleanUp: function () {
                    return Promise.resolve();
                }
            };
        }
    }
});

// Run
tmr.run();
