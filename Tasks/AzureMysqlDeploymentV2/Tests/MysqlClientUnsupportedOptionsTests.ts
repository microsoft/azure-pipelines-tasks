import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import * as path from 'path';

export class MysqlClientUnsupportedOptionsTests {

    public static startMysqlClientUnsupportedOptionsL0Tests() {
        let tp = path.join(__dirname, 'MysqlClientUnsupportedOptionsL0Tests.js');
        let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        tr.setInput('ConnectedServiceName', 'DEMO_CONNECTED_SERVICE_NAME');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('SqlUsername', 'DEMO_SQL_USERNAME');
        tr.setInput('SqlPassword', 'DEMO_SQL_PASSWORD');
        tr.setInput('TaskNameSelector', 'InlineSqlTask');
        tr.setInput('SqlInline', 'SELECT 1;');
        // Regression input: a value that is not supported for additional
        // arguments and must be rejected before reaching the mysql client.
        tr.setInput('SqlAdditionalArguments', '--skip-binary-mode --');

        // No "exec" answer is registered for the rejection scenarios: the
        // task must fail validation before ever attempting to invoke the
        // mysql client. One "exec" answer is registered for the negative
        // control (a quoted "--" value that must be allowed through).
        let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "/usr/local/bin/mysql": "/usr/local/bin/mysql"
            },
            "checkPath": {
                "/usr/local/bin/mysql": true
            },
            "exec": {
                "/usr/local/bin/mysql -hDEMO_MYSQL_SERVER -uDEMO_SQL_USERNAME -pDEMO_SQL_PASSWORD --ssl-mode=REQUIRED --default-character-set=-- --binary-mode -eSELECT 1;": {
                    "code": 0,
                    "stdout": ""
                }
            }
        };
        tr.setAnswers(a);
        tr.run();
    }
}

MysqlClientUnsupportedOptionsTests.startMysqlClientUnsupportedOptionsL0Tests();
