// An unusable service connection must stop the deployment, not fall back to the agent's identity.
//
// A WIF endpoint missing its client id or SYSTEM_ACCESSTOKEN used to warn and return no credentials.
// sqlcmd was then invoked with ActiveDirectoryDefault and none of the service connection's
// environment, so azidentity resolved whatever the agent happened to carry - a managed identity, an
// az login session, or unrelated AZURE_* variables. The SQL-scoped token acquired later does not
// help, because sqlcmd never consumes it.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// A real agent always exposes SYSTEMVSSCONNECTION, so supplying it here keeps the test on the
// case that actually happens: the endpoint itself is missing the client id.
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'system-access-token';

const scriptPath = 'script.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=db;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
tmr.setInput('firewallRuleManagement', 'false');

// Workload Identity Federation endpoint with no client id: the credential cannot be built.
const azureEndpoint: any = {
    scheme: 'WorkloadIdentityFederation',
    environment: 'AzureCloud',
    tenantID: 'my-tenant-id',
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
