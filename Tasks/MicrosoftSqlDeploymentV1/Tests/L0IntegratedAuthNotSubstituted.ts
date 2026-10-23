// Integrated authentication must not be replaced by the service connection identity.
//
// Active Directory Integrated names the caller's domain account. Supplying azureSubscription for
// firewall management or Entra sign-in used to put this auth type in the token-based list, so
// SqlPackage received /AccessToken and deployed as the service principal instead. That is the same
// identity substitution already fixed for managed identity.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const connectionString = 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Integrated;';

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', connectionString);
tmr.setInput('azureSubscription', 'test-subscription-id');
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
        async getToken() { return 'service-connection-token'; }
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

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {}
};

// The connection string is passed through whole, so SqlPackage resolves the domain identity itself.
// Only this form is answered: an /AccessToken invocation has no mock and fails the test.
(a.exec as any)[`/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetConnectionString:${connectionString}`] = {
    code: 0,
    stdout: 'Successfully published database.'
};

tmr.setAnswers(a);

tmr.run();
