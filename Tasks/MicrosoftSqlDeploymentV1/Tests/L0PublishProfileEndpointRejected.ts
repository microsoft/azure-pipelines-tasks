// An AzureRM Publish Profile service connection must stop the deployment, not fall back to the
// agent's identity.
//
// A Publish Profile endpoint carries no tenantID, and credential resolution used to return early on
// that before it looked at the scheme. sqlcmd then ran with ActiveDirectoryDefault and none of the
// service connection's environment, so azidentity resolved whatever the agent held - a managed
// identity or an existing az login session - while telemetry reported the credential source as
// default.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'system-access-token';

const scriptPath = 'script.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=db;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
tmr.setInput('firewallRuleManagement', 'false');

// Publish Profile endpoints carry no tenantID and no service principal, which is what made the
// tenant check short-circuit ahead of the scheme check.
const azureEndpoint: any = {
    scheme: 'PublishProfile',
    environment: 'AzureCloud',
    tenantID: undefined,
    servicePrincipalClientID: undefined,
    applicationTokenCredentials: {
        activeDirectoryResourceId: 'https://management.azure.com/',
        baseUrl: 'https://management.azure.com/',
        async getToken() { return 'access-token'; }
    }
};

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() { return azureEndpoint; }
    }
});

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { [scriptPath]: true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    // No exec answers at all. Any sqlcmd invocation shows up as an unmatched command in the log,
    // which the assertion checks for.
    exec: {}
};

tmr.setAnswers(a);

tmr.run();
