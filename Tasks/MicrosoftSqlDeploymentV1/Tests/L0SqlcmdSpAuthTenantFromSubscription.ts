// AAD Service Principal auth with an azureSubscription: go-mssqldb needs the tenant, which
// the service connection supplies, so the user name is sent as clientId@tenantId.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
// No @tenant in User ID — it must come from the service connection
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Service Principal;User ID=my-client-id;Password=my-client-secret;');
tmr.setInput('azureSubscription', 'test-service-connection-id');
tmr.setInput('firewallRuleManagement', 'false');

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'ServicePrincipal',
                tenantID: 'my-tenant-id',
                servicePrincipalClientID: 'sc-client-id',
                servicePrincipalKey: 'sc-client-secret',
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
        // Tenant appended from the service connection; secret still travels via SQLCMDPASSWORD
        '/usr/bin/sqlcmd -S myserver.database.windows.net -d testdb --authentication-method ActiveDirectoryServicePrincipal -U my-client-id@my-tenant-id -l 30 -b -i test.sql': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
