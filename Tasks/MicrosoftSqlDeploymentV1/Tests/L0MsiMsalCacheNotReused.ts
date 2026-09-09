// Managed Identity + Active Directory Default + firewall management enabled.
//
// Models the MSAL caching semantics of ApplicationTokenCredentials: getMSAL() reuses an
// existing msalInstance rather than rebuilding, and configureMSALWithMSI captures the
// audience at build time ("let resourceId = this.activeDirectoryResourceId") instead of
// re-reading it per call. Firewall management runs before the SQL token is acquired, so by
// that point the shared credential already has an msalInstance built against the ARM
// resource.
//
// If createSqlScopedCredentials copies that instance, getToken() hands back an ARM-audience
// token that Azure SQL rejects. The expected exec below only matches the SQL-audience token.
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

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'ManagedServiceIdentity',
                environment: 'AzureCloud',
                tenantID: 'my-tenant-id',
                applicationTokenCredentials: {
                    activeDirectoryResourceId: ARM_RESOURCE,
                    baseUrl: ARM_RESOURCE,

                    // Already built during firewall management, capturing the ARM resource.
                    msalInstance: { capturedResource: ARM_RESOURCE },

                    token_deferred: undefined,

                    async getToken(_force?: boolean) {
                        // getMSAL(): reuse the existing instance, otherwise build one that
                        // captures whatever activeDirectoryResourceId is set at build time.
                        if (!this.msalInstance) {
                            this.msalInstance = { capturedResource: this.activeDirectoryResourceId };
                        }
                        return `token-for:${this.msalInstance.capturedResource}`;
                    }
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

// firewallRuleManagement is on, so the task discovers sqlcmd for the connectivity probe.
tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() { return '/usr/bin/sqlcmd'; }
    }
});

// Connectivity succeeds, so no firewall rule is created and no ARM call is needed here.
// The credential still arrives with its msalInstance already built, which is the point.
tmr.registerMock('./src/SqlUtils', {
    default: {
        detectIPAddress: async function() { return ''; }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: { 'test.dacpac': true, '/usr/local/bin/sqlpackage': true, '/usr/bin/sqlcmd': true },
    which: { '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage', '/usr/bin/sqlcmd': '/usr/bin/sqlcmd' },
    exec: {
        // Only the SQL-audience token matches. An ARM-audience token fails the run.
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetServerName:myserver.database.windows.net /TargetDatabaseName:testdb /AccessToken:token-for:https://database.windows.net/': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
