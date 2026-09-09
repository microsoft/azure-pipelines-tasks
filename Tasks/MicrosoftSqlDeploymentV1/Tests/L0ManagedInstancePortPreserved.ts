// A managed instance public endpoint must keep its port on the /AccessToken path.
//
// SqlConnectionConfig.Server deliberately returns the host without the port, because ARM lookup and
// DNS need it that way. SqlPackage needs it back: the MI public endpoint listens on 3342, so
// dropping the port sends the deployment to 1433 and it cannot connect. The sqlcmd path already
// rebuilt Server,Port; this pins the same behaviour for SqlPackage.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=mi.public.zone.database.windows.net,3342;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
// A managed instance has no Azure SQL firewall rules, so the step is off for this target.
tmr.setInput('firewallRuleManagement', 'false');

const azureEndpoint: any = {
    scheme: 'ServicePrincipal',
    environment: 'AzureCloud',
    tenantID: 'my-tenant-id',
    servicePrincipalClientID: 'my-client-id',
    servicePrincipalKey: 'my-client-secret',
    applicationTokenCredentials: {
        activeDirectoryResourceId: 'https://management.azure.com/',
        baseUrl: 'https://management.azure.com/',
        async getToken() { return 'sql-access-token'; }
    }
};

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() { return azureEndpoint; }
    }
});

tmr.registerMock('./src/SqlTokenCredentials', {
    getSqlAudienceFromEnvironment: () => 'https://database.windows.net/',
    createSqlScopedCredentials: () => ({ getToken: async () => 'sql-access-token' })
});

tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() { return '/usr/local/bin/sqlpackage'; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {}
};

// Only the port-carrying form is answered: dropping the port leaves the command unmatched.
(a.exec as any)['/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetServerName:mi.public.zone.database.windows.net,3342 /TargetDatabaseName:testdb /AccessToken:sql-access-token'] = {
    code: 0,
    stdout: 'Successfully published database.'
};

tmr.setAnswers(a);

tmr.run();
