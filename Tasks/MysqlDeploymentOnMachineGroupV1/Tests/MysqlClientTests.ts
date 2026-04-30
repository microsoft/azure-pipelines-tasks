import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import * as path from 'path';

export class MysqlClientTests  {

    public static startMysqlClientL0Tests(){
        let tp = path.join(__dirname, 'MysqlClientL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput("SqlUsername", "DEMO_SQL_USERNAME");
        tr.setInput("SqlPassword","DEMO_SQL_PASSWORD");
        tr.setInput("TaskNameSelector", "SqlFile");
        tr.setInput("SqlFile", "/path/to/script.sql");
        // provide answers for task mock
        let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "/usr/local/bin/mysql" : "/usr/local/bin/mysql"
            },
            "checkPath": {
                "/usr/local/bin/mysql": true
            },
            "exec": {
                '/usr/local/bin/mysql -hMOCK_SERVER_NAME -uDEMO_SQL_USERNAME -pDEMO_SQL_PASSWORD -e source /path/to/script.sql' : {
                    "code": 0,
                    "stderr": "=executed successfully."
                }

            }
        };
        tr.setAnswers(a);
        tr.registerMock('azure-pipelines-tasks-webdeployment-common/packageUtility.js', {
            PackageUtility: {
                getPackagePath: function(packagePath) {
                    return packagePath;
                }
            }
        });
        tr.run();
    }

}

MysqlClientTests.startMysqlClientL0Tests();
