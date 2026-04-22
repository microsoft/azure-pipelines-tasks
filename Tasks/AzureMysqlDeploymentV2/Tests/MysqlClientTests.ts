import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import * as path from 'path';

export class MysqlClientTests  {

    public static startMysqlClientL0Tests(){
        let tp = path.join(__dirname, 'MysqlClientL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        tr.setInput('IpDetectionMethod', 'IPAddressRange')
        tr.setInput('IpDetectionMethod', 'IPAddressRange');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('StartIpAddress', '0.0.0.0');
        tr.setInput("EndIpAddress", "255.255.255.255");
        tr.setInput("IpDetectionMethod", "IPAddressRange");
        tr.setInput("ConnectedServiceName", "DEMO_CONNECTED_SERVICE_NAME");
        tr.setInput("SqlUsername", "DEMO_SQL_USERNAME");
        tr.setInput("SqlPassword","DEMO_SQL_PASSWORD");
        tr.setInput("TaskNameSelector", "SqlFile");
        // provide answers for task mock
        let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "/usr/local/bin/mysql" : "/usr/local/bin/mysql"
            },
            "checkPath": {
                "/usr/local/bin/mysql": true
            },
            "exec": {
                "/usr/local/bin/mysql -hDEMO_MYSQL_SERVER -uDEMO_SQL_USERNAME -pDEMO_SQL_PASSWORD --ssl-mode=REQUIRED" : {
                    "code": 1,
                    "stderr": "ERROR 9000 (HY000): Client with IP address '250.250.250.250' is not allowed to connect to this MySQL server."
                }
                // Note: File-based SQL execution (_executeSqlScriptFromFile) uses child_process.spawn
                // with stdin piping. MysqlClient accepts an injectable spawn function via the
                // constructor's 4th parameter, enabling unit tests for this code path.
            }
        };
        tr.setAnswers(a);
        tr.run();
    }

}

MysqlClientTests.startMysqlClientL0Tests();
