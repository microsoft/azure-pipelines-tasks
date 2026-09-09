// A sovereign service connection must point sqlcmd at its own Entra authority.
//
// go-sqlcmd's azidentity defaults to the public cloud when neither its cloud options nor
// AZURE_AUTHORITY_HOST is supplied. Measured against go-sqlcmd v1.10: with the variable unset the
// token request goes to login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration,
// and with it set to the US Government authority the same request goes to login.microsoftonline.us.
// Omitting it meant a Government or China sign-in contacted the public authority.
//
// The assertion is on the applied environment variable names rather than the command line, because
// this credential material never appears as an argument.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const scriptPath = 'script.sql';

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', scriptPath);
tmr.setInput('connectionString', 'Server=myserver.database.usgovcloudapi.net;Database=db;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'usgov-subscription');
tmr.setInput('firewallRuleManagement', 'false');

const azureEndpoint: any = {
    scheme: 'ServicePrincipal',
    environment: 'AzureUSGovernment',
    environmentAuthorityUrl: 'https://login.microsoftonline.us/',
    tenantID: 'my-tenant-id',
    servicePrincipalClientID: 'my-client-id',
    servicePrincipalKey: 'my-client-secret',
    applicationTokenCredentials: {
        activeDirectoryResourceId: 'https://management.usgovcloudapi.net/',
        baseUrl: 'https://management.usgovcloudapi.net/',
        async getToken() { return 'access-token'; }
    }
};

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() { return azureEndpoint; }
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

(a.exec as any)['/usr/bin/sqlcmd -S myserver.database.usgovcloudapi.net -d db --authentication-method ActiveDirectoryDefault -l 30 -b -i script.sql'] = {
    code: 0,
    stdout: 'Changed database context to db.'
};

tmr.setAnswers(a);

tmr.run();
