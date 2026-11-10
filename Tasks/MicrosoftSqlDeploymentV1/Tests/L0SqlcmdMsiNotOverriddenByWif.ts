// An explicit `Authentication=Active Directory Managed Identity` must be honoured as-is,
// even when a Workload Identity Federation service connection is supplied (typically only
// for firewall management). Overriding it with ActiveDirectoryAzurePipelines would silently
// authenticate as the service connection principal instead of the agent's managed identity.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Managed Identity;');
tmr.setInput('azureSubscription', 'test-service-connection-id');
// Skip the connectivity probe so this test isolates the deployment command
tmr.setInput('firewallRuleManagement', 'false');

process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'fake-system-access-token';

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'WorkloadIdentityFederation',
                tenantID: 'my-tenant-id',
                servicePrincipalClientID: 'my-client-id',
                applicationTokenCredentials: {
                    activeDirectoryResourceId: 'https://management.azure.com/',
                    getToken: async (_force: boolean) => 'fake-sql-access-token'
                }
            };
        }
    }
});

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        // The requested managed identity method survives; no ActiveDirectoryAzurePipelines override.
        '/usr/bin/sqlcmd -S myserver.database.windows.net -d testdb --authentication-method ActiveDirectoryManagedIdentity -l 30 -b -i test.sql': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
