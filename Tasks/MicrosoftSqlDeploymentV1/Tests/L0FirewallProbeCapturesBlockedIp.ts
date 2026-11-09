// The firewall probe must capture sqlcmd's output so it can parse the blocked client IP.
//
// tl.exec with silent: true never writes to a custom outStream/errStream, so capturing that
// way yielded an empty error: detectIPAddress could not find an IP, firewall provisioning
// silently never happened, and the task failed with "Unknown error" instead. Capturing
// through the stdout/stderr events works regardless of silent.
//
// Here the probe is rejected by the server firewall. The task must parse 203.0.113.10 out of
// that message and create a rule for it.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Service Principal;User ID=my-client-id;Password=my-client-secret;');
tmr.setInput('azureSubscription', 'test-service-connection-id');
// Real SqlUtils probe runs; it is deliberately not mocked here.
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
                    getToken: async (_force: boolean) => 'fake-arm-token'
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

// Records the IP the task derived from the probe output.
tmr.registerMock('./src/AzureSqlResourceManager', {
    default: {
        getResourceManager: async function(_serverName: string, _endpoint: any) {
            return {
                addFirewallRule: async function(startIp: string, _endIp: string) {
                    console.log(`ADD_RULE_IP:${startIp}`);
                    return { name: `ClientIp_${startIp}`, id: '/subscriptions/x/firewallRules/rule' };
                },
                removeFirewallRule: async function(rule: any) {
                    console.log(`REMOVE_RULE:${rule.name}`);
                }
            };
        }
    }
});

const probeQuery = `SELECT 'Validating connection from Azure Pipelines SQL Deployment Task'`;
const probeCmd = `/usr/bin/sqlcmd -S myserver.database.windows.net -d master --authentication-method ActiveDirectoryServicePrincipal -U my-client-id@my-tenant-id -l 15 -Q ${probeQuery}`;

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {}
};

// The probe is blocked by the server firewall. This is the message the IP must come from.
(a.exec as any)[probeCmd] = {
    code: 1,
    stdout: '',
    stderr: `Sqlcmd: Error: Microsoft ODBC Driver 18 for SQL Server : Cannot open server 'myserver' requested by the login. `
          + `Client with IP address '203.0.113.10' is not allowed to access the server. `
          + `To enable access, use the Windows Azure Management Portal or run sp_set_firewall_rule on the master database.`
};

// Deployment proceeds once the rule exists.
(a.exec as any)['/usr/bin/sqlcmd -S myserver.database.windows.net -d testdb --authentication-method ActiveDirectoryServicePrincipal -U my-client-id@my-tenant-id -l 30 -b -i test.sql'] = {
    code: 0,
    stdout: 'Changed database context to testdb.'
};

tmr.setAnswers(a);

tmr.run();
