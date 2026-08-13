// Succeeds when azureSubscription is set and access token is acquired with SQL audience.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('action', 'publish');
tmr.setInput('path', 'test.dacpac');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=testdb;Authentication=Active Directory Default;');
tmr.setInput('azureSubscription', 'test-subscription-id');

// Mock AzureRMEndpoint — returns ServicePrincipal endpoint with applicationTokenCredentials
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(_connectedServiceName: string) {}
        async getEndpoint() {
            return {
                scheme: 'ServicePrincipal',
                // A real ServicePrincipal endpoint always carries these. Omitting them describes an
                // endpoint that cannot be materialized, which the task now rejects.
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

// Mock SqlPackageHelper
tmr.registerMock('./src/SqlPackageHelper', {
    default: {
        findSqlPackage: async function() {
            return '/usr/local/bin/sqlpackage';
        }
    }
});

// Mock SqlcmdHelper — firewallRuleManagement defaults to true when azureSubscription
// is set, so sqlcmd discovery is triggered
tmr.registerMock('./src/SqlcmdHelper', {
    default: {
        findSqlcmd: async function() {
            return '/usr/bin/sqlcmd';
        }
    }
});

// Mock SqlUtils — detectIPAddress returns empty so no firewall rule is created
tmr.registerMock('./src/SqlUtils', {
    default: {
        detectIPAddress: async function() {
            return '';
        }
    }
});

const a: ma.TaskLibAnswers = {
    checkPath: {
        'test.dacpac': true,
        '/usr/local/bin/sqlpackage': true
    },
    which: {
        '/usr/local/bin/sqlpackage': '/usr/local/bin/sqlpackage'
    },
    exec: {
        '/usr/local/bin/sqlpackage /Action:Publish /SourceFile:test.dacpac /TargetServerName:myserver.database.windows.net /TargetDatabaseName:testdb /AccessToken:fake-sql-access-token': {
            code: 0,
            stdout: 'Successfully published database.'
        }
    }
};
tmr.setAnswers(a);

tmr.run();
