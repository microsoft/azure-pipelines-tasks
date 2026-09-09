// The scenario this PR exists to fix, end to end:
//   firewall rule added -> SQL token acquired -> removeFirewallRule() in the finally block
//   still succeeds because the shared ARM credential was never repointed at the SQL audience.
//
// FirewallManager is the real implementation. The resource manager is faked, but it calls
// getToken() on the shared endpoint credential exactly like ServiceClient does, so a
// credential that has been poisoned with a SQL-audience token surfaces here.
//
// removeFirewallRule() only warns on failure, so the assertions check both the token the ARM
// call received and the absence of the FailedToRemoveFirewallRule warning - a task that leaks
// the rule would otherwise still report success.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
tmr.setInput('firewallRuleManagement', 'true');

const ARM_RESOURCE = 'https://management.azure.com/';
const SQL_RESOURCE = 'https://database.windows.net/';

// Models ADAL memoization: getToken() caches into token_deferred and later non-forced calls
// return whatever was cached first.
const armCredentials: any = {
    activeDirectoryResourceId: ARM_RESOURCE,
    baseUrl: ARM_RESOURCE,
    token_deferred: undefined,
    msalInstance: undefined,
    accessToken: undefined,
    async getToken(force?: boolean) {
        if (!this.token_deferred || force) {
            this.token_deferred = `token-for:${this.activeDirectoryResourceId}`;
        }
        return this.token_deferred;
    }
};

const azureEndpoint: any = {
    scheme: 'ServicePrincipal',
    environment: 'AzureCloud',
    tenantID: 'my-tenant-id',
    servicePrincipalClientID: 'my-client-id',
    servicePrincipalKey: 'my-client-secret',
    applicationTokenCredentials: armCredentials
};

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() { return azureEndpoint; }
    }
});

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

// A blocked client IP, so a rule really is created and must later be removed.
tmr.registerMock('./src/SqlUtils', {
    default: {
        detectIPAddress: async function() { return '203.0.113.10'; }
    }
});

// Stands in for ServiceClient: every ARM operation takes a token from the shared credential.
tmr.registerMock('./src/AzureSqlResourceManager', {
    default: {
        getResourceManager: async function(_serverName: string, endpoint: any) {
            return {
                addFirewallRule: async function(startIp: string, _endIp: string) {
                    const token = await endpoint.applicationTokenCredentials.getToken();
                    console.log(`ADD_RULE_TOKEN:${token}`);
                    return { name: `ClientIp_${startIp}`, id: '/subscriptions/x/firewallRules/rule' };
                },
                removeFirewallRule: async function(_rule: any) {
                    const token = await endpoint.applicationTokenCredentials.getToken();
                    console.log(`REMOVE_RULE_TOKEN:${token}`);
                    if (token.indexOf(ARM_RESOURCE) < 0) {
                        // What ARM does when handed a SQL-audience token.
                        throw new Error(`AudienceMismatch: ARM rejected ${token}`);
                    }
                }
            };
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage', '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        // The deployment must still receive a SQL-audience token.
        [`/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetServerName:myserver.database.windows.net /TargetDatabaseName:testdb /AccessToken:token-for:${SQL_RESOURCE}`]: {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
