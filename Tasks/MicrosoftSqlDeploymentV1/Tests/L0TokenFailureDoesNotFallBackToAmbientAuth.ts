// A service connection token failure must stop the deployment, not fall back to ambient auth.
//
// Leaving accessToken undefined makes buildArguments() drop /AccessToken and pass
// /TargetConnectionString:...;Authentication=Active Directory Default instead. SqlPackage then
// runs its own DefaultAzureCredential chain and can deploy as the agent's managed identity or a
// stale az login session - often a broader principal than the service connection the user chose -
// while still reporting success.
//
// The exec answers below deliberately contain no SqlPackage command, so the task fails if it
// attempts one. That is what proves the deployment never started.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'my-service-connection');
tmr.setInput('firewallRuleManagement', 'false');

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'ServicePrincipal',
                environment: 'AzureCloud',
                tenantID: 'my-tenant-id',
                servicePrincipalClientID: 'my-client-id',
                servicePrincipalKey: 'my-client-secret',
                applicationTokenCredentials: {
                    activeDirectoryResourceId: 'https://management.azure.com/',
                    getToken: async (_force?: boolean) => 'arm-token'
                }
            };
        }
    }
});

// The SQL-scoped credential is what fails: expired secret, revoked app registration,
// conditional access, and so on.
tmr.registerMock('./src/SqlTokenCredentials', {
    getSqlAudienceFromEnvironment: (_environment: string) => 'https://database.windows.net/',
    createSqlScopedCredentials: (_endpoint: any, _audience: string) => ({
        getToken: async () => { throw new Error('AADSTS7000215: Invalid client secret provided.'); }
    })
});

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    // No SqlPackage entry: any invocation is an unmatched command and fails the test.
    exec: {}
};
tmr.setAnswers(a);

tmr.run();
