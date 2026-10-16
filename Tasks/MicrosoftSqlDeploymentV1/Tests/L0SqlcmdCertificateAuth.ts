// A certificate-backed service principal must authenticate go-sqlcmd as the service connection.
//
// The scheme is still ServicePrincipal but there is no servicePrincipalKey, so the client-secret
// branch does not match. Without a certificate branch this fell through to DefaultAzureCredential,
// which on a hosted agent fails with "EnvironmentCredential: missing environment variable
// AZURE_TENANT_ID" and then "ManagedIdentityCredential: ... Identity not found".
//
// AzureRMEndpoint writes the PEM to disk and exposes servicePrincipalCertificatePath;
// EnvironmentCredential picks it up from AZURE_CLIENT_CERTIFICATE_PATH.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'sqlScript');
tmr.setInput('path', 'test.sql');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-service-connection-id');
// Skip the connectivity probe so this test isolates the deployment command
tmr.setInput('firewallRuleManagement', 'false');

const CERT_PATH = '/tmp/spnCert.pem';

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'ServicePrincipal',
                authenticationType: 'spnCertificate',
                tenantID: 'my-tenant-id',
                servicePrincipalClientID: 'my-client-id',
                // No servicePrincipalKey: certificate connections carry a PEM instead.
                servicePrincipalCertificatePath: CERT_PATH,
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

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.sql': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        // Credentials arrive through AZURE_* env vars, so no -U on the command line.
        '/usr/bin/sqlcmd -S myserver.database.windows.net -d testdb --authentication-method ActiveDirectoryDefault -l 30 -b -i test.sql': {
            code: 0,
            stdout: 'Changed database context to testdb.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
