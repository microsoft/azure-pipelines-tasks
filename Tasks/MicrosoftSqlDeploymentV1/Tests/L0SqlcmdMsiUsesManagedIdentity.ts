// A Managed Identity service connection must authenticate as that identity, not as whatever
// DefaultAzureCredential resolves first.
//
// ActiveDirectoryDefault used to be left in place for an MSI endpoint, so go-sqlcmd ran the whole
// DefaultAzureCredential chain with the agent's ambient environment. That chain reaches environment
// and Azure CLI credentials before managed identity, and it ignores msiClientId entirely, so a
// user-assigned identity could be replaced by the system-assigned one or by a stale az login.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'script.sql';
const msiClientId = '11111111-2222-3333-4444-555555555555';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=db;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
tmr.setInput('firewallRuleManagement', 'false');

// A user-assigned identity: the client id is the only thing that distinguishes it from the
// system-assigned identity on the same agent.
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'ManagedServiceIdentity',
                environment: 'AzureCloud',
                tenantID: 'my-tenant-id',
                msiClientId: msiClientId,
                applicationTokenCredentials: {
                    activeDirectoryResourceId: 'https://management.azure.com/',
                    baseUrl: 'https://management.azure.com/',
                    async getToken() { return 'access-token'; }
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
    checkPath: { [scriptPath]: true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {}
};

// Only the pinned method carrying the client id is answered. Leaving ActiveDirectoryDefault in
// place, or dropping the client id, leaves the command line unmatched and fails the test.
(a.exec as any)[`/usr/bin/sqlcmd -S myserver.database.windows.net -d db --authentication-method ActiveDirectoryManagedIdentity -U ${msiClientId} -l 30 -b -i script.sql`] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
