// Asking for firewall management on an unsupported target must say so.
//
// An explicit firewallRuleManagement: true against a managed instance used to run the ARM
// enumeration and fail with SQLServerNotFoundInSubscription, which points the user at their
// subscription rather than at the real constraint.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=myinstance.abc123def.database.windows.net;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
tmr.setInput('firewallRuleManagement', 'true');

const azureEndpoint: any = {
    scheme: 'ServicePrincipal',
    environment: 'AzureCloud',
    tenantID: 'my-tenant-id',
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

tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage', '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {}
};
tmr.setAnswers(a);

tmr.run();
