// A managed instance target must not silently enable firewall management.
//
// firewallRuleManagement used to default to true whenever azureSubscription was supplied, but the
// firewall implementation enumerates Microsoft.Sql/servers. A managed instance is a
// Microsoft.Sql/managedInstances resource with no IP firewall rules, so the step could never
// succeed and the run failed while looking the server up in ARM. Supplying azureSubscription for
// Entra authentication alone must remain safe.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=myinstance.abc123def.database.windows.net;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
// firewallRuleManagement deliberately not set: this pins the default.

const azureEndpoint: any = {
    scheme: 'ServicePrincipal',
    environment: 'AzureCloud',
    tenantID: 'my-tenant-id',
    servicePrincipalClientID: 'my-client-id',
    servicePrincipalKey: 'my-client-secret',
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

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

// Reaching either of these means firewall management ran for a managed instance.
tmr.registerMock('./src/SqlUtils', {
    default: {
        detectIPAddress: async function() {
            console.log('FIREWALL_PROBE_RAN');
            return '203.0.113.10';
        }
    }
});

tmr.registerMock('./src/AzureSqlResourceManager', {
    default: {
        getResourceManager: async function() {
            console.log('ARM_LOOKUP_RAN');
            throw new Error('SQLServerNotFoundInSubscription');
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetServerName:myinstance.abc123def.database.windows.net /TargetDatabaseName:testdb /AccessToken:access-token': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
