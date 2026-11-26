// SQL authentication carries its own credentials in the connection string, so the task
// must not request a SQL access token even though an azureSubscription is configured.
// A needless request is wasteful and, on the ADAL path, poisons the shared credential cache.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
// SQL auth — no Authentication= keyword, credentials supplied inline
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;User ID=sa;Password=TestPass123!;');
tmr.setInput('azureSubscription', 'test-subscription-id');
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
                    baseUrl: 'https://management.azure.com/',
                    async getToken(_force?: boolean) {
                        // Should never run for SQL authentication.
                        console.log('UNEXPECTED_TOKEN_REQUEST');
                        return 'should-not-be-used';
                    }
                }
            };
        }
    }
});

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {
        // No /AccessToken — the connection string carries the credentials
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetConnectionString:Server=myserver.database.windows.net;Database=testdb;User ID=sa;Password=TestPass123!;': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
