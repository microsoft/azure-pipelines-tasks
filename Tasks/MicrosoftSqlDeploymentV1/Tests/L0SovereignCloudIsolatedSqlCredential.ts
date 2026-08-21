// Verifies two things for a sovereign cloud (US Gov) service connection:
//  1. The SQL token is requested with the US Gov SQL audience, not the public cloud one.
//  2. The token is requested from a distinct credential object rather than the shared
//     endpoint credential.
//
// Firewall management is disabled here to isolate the audience derivation, so this test
// says nothing about rule cleanup. The add -> token -> remove cycle that the isolation
// actually protects is covered by L0FirewallRuleRemovedAfterTokenAcquisition.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=myserver.database.usgovcloudapi.net;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');
tmr.setInput('firewallRuleManagement', 'false');

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            const armCredentials: any = {
                activeDirectoryResourceId: 'https://management.usgovcloudapi.net/',
                baseUrl: 'https://management.usgovcloudapi.net/',
                token_deferred: 'arm-token-already-cached',
                async getToken(_force?: boolean) {
                    // Report which audience this credential is scoped to, and whether the
                    // call landed on the shared ARM credential or an isolated clone.
                    console.log(`TOKEN_AUDIENCE:${this.activeDirectoryResourceId}`);
                    console.log(`TOKEN_BASEURL:${this.baseUrl}`);
                    console.log(`IS_SHARED_ARM_CREDENTIAL:${this.__isSharedArmCredential === true}`);
                    return 'fake-usgov-sql-token';
                }
            };

            // Non-enumerable so Object.assign in createSqlScopedCredentials does not copy it.
            // Its absence on the credential used for the token proves a clone was used.
            Object.defineProperty(armCredentials, '__isSharedArmCredential', {
                value: true,
                enumerable: false
            });

            return {
                scheme: 'ServicePrincipal',
                environment: 'AzureUSGovernment',
                tenantID: 'my-tenant-id',
                servicePrincipalClientID: 'my-client-id',
                servicePrincipalKey: 'my-client-secret',
                applicationTokenCredentials: armCredentials
            };
        }
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
    exec: {
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetServerName:myserver.database.usgovcloudapi.net /TargetDatabaseName:testdb /AccessToken:fake-usgov-sql-token': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
