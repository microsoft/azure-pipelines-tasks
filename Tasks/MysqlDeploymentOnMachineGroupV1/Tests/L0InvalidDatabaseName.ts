import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'mysqldeploy.js');
const tr = new tmrm.TaskMockRunner(taskPath);

tr.setInput('TaskNameSelector', 'InlineSqlTask');
tr.setInput('SqlInline', 'SELECT 1');
tr.setInput('ServerName', 'localhost');
tr.setInput('DatabaseName', 'database.invalid');
tr.setInput('SqlUsername', 'user');
tr.setInput('SqlPassword', 'password');

tr.registerMock('./operations/ToolPathOperations', {
    ToolPathOperations: function() {
        return {
            getInstalledPathOfMysql: function() {
                console.log('MYSQL_EXECUTION_REACHED');
                return Promise.resolve('/usr/local/bin/mysql');
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
