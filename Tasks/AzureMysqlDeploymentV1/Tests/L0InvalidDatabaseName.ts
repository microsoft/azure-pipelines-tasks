import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'azuremysqldeploy.js');
const tr = new tmrm.TaskMockRunner(taskPath);

tr.setInput('ConnectedServiceName', 'DEMO_CONNECTED_SERVICE_NAME');
tr.setInput('TaskNameSelector', 'InlineSqlTask');
tr.setInput('SqlInline', 'SELECT 1');
tr.setInput('ServerName', 'localhost');
tr.setInput('DatabaseName', 'database.invalid');
tr.setInput('SqlUsername', 'user');
tr.setInput('SqlPassword', 'password');
tr.setInput('IpDetectionMethod', 'AutoDetect');

tr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: function() {
        return {
            getEndpoint: function() {
                return Promise.resolve({
                    applicationTokenCredentials: {},
                    subscriptionID: 'subscription'
                });
            }
        };
    }
});

tr.registerMock('./operations/MysqlServerOperations', {
    MysqlServerOperations: function() {
        return {
            getMysqlServerFromServerName: function() {
                return Promise.resolve({
                    getFullyQualifiedName: function() { return 'mysql-server'; },
                    getName: function() { return 'mysql-server'; },
                    getResourceGroupName: function() { return 'resource-group'; }
                });
            }
        };
    }
});

tr.registerMock('./operations/ToolPathOperations', {
    ToolPathOperations: function() {
        return {
            getInstalledPathOfMysql: function() {
                return Promise.resolve('/usr/local/bin/mysql');
            }
        };
    }
});

tr.registerMock('./operations/FirewallOperations', {
    FirewallOperations: function() {
        return {
            invokeFirewallOperations: function() {
                return Promise.resolve(false);
            }
        };
    }
});

tr.registerMock('./sql/MysqlClient', {
    MysqlClient: function() {
        return {
            executeSqlCommand: function() {
                console.log('MYSQL_EXECUTION_REACHED');
                return Promise.resolve(0);
            }
        };
    }
});

tr.run();
