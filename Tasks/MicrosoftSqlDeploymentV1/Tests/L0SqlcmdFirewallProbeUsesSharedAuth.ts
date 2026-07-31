// The firewall connectivity probe must use the same authentication mapping as the
// deployment. It previously sent -G, which go-sqlcmd resolves to ActiveDirectoryPassword
// when a user name and password are present — never ActiveDirectoryServicePrincipal.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Service Principal;User ID=my-client-id;Password=my-client-secret;');
tmr.setInput('azureSubscription', 'test-service-connection-id');
// Leave firewall management on so the real SqlUtils probe runs
tmr.setInput('firewallRuleManagement', 'true');

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

const probeQuery = `SELECT 'Validating connection from Azure Pipelines SQL Deployment Task'`;

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        // Probe: master database, 15s login timeout, same auth mapping as the deployment.
        // Succeeding here means no firewall rule is needed.
        [`/usr/bin/sqlcmd -S myserver.database.windows.net -d master --authentication-method ActiveDirectoryServicePrincipal -U my-client-id@my-tenant-id -l 15 -Q ${probeQuery}`]: {
            code: 0,
            stdout: 'Validating connection from Azure Pipelines SQL Deployment Task'
        },
        '/usr/bin/sqlcmd -S myserver.database.windows.net -d testdb --authentication-method ActiveDirectoryServicePrincipal -U my-client-id@my-tenant-id -l 30 -b -i test.sql': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
