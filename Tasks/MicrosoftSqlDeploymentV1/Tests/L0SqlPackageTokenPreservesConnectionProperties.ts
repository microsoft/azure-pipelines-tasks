// A token-authenticated deployment must keep the caller's non-authentication settings.
//
// The token branch used to rebuild the target from the server and database alone, so an explicit
// Encrypt=Strict, a pinned ServerCertificate, the read-only routing hint and the connect timeout
// never reached SqlPackage. The deployment went green having silently dropped the security
// controls the caller asked for.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput(
    'connectionString',
    'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Default;' +
    'Encrypt=Strict;ServerCertificate=/certs/server.cer;ApplicationIntent=ReadOnly;Connect Timeout=99'
);
tmr.setInput('azureSubscription', 'test-subscription-id');

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'ServicePrincipal',
                tenantID: 'my-tenant-id',
                servicePrincipalClientID: 'my-client-id',
                servicePrincipalKey: 'my-client-secret',
                applicationTokenCredentials: {
                    activeDirectoryResourceId: 'https://management.azure.com/',
                    getToken: async (_force: boolean) => 'fake-sql-access-token'
                }
            };
        }
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

tmr.registerMock('./src/SqlUtils', {
    default: {
        detectIPAddress: async function() { return ''; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage' },
    exec: {}
};

// The authentication property is the only one removed, because the token supplies the identity.
// Everything else is preserved, and no credential is reintroduced on the command line.
(a.exec as any)['/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac ' +
    '/TargetConnectionString:server=myserver.database.windows.net;database=testdb;encrypt=Strict;' +
    'servercertificate=/certs/server.cer;applicationintent=ReadOnly;connect timeout=99 ' +
    '/AccessToken:fake-sql-access-token'] = {
    code: 0,
    stdout: 'Successfully published database.'
};

tmr.setAnswers(a);

tmr.run();
