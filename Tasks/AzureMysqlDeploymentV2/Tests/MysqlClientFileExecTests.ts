import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import * as path from 'path';
import * as os from 'os';

export class MysqlClientFileExecTests {

    public static startTests() {
        let tp = path.join(__dirname, 'MysqlClientFileExecL0Tests.js');
        let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

        const sqlFilePath = path.join(os.tmpdir(), 'test_azure_mysql_deploy.sql');

        tr.setInput('ConnectedServiceName', 'DEMO_CONNECTED_SERVICE_NAME');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('SqlUsername', 'DEMO_SQL_USERNAME');
        tr.setInput('SqlPassword', 'DEMO_SQL_PASSWORD');
        tr.setInput('TaskNameSelector', 'SqlFile');
        tr.setInput('SqlFile', sqlFilePath);
        tr.setInput('IpDetectionMethod', 'IPAddressRange');
        tr.setInput('StartIpAddress', '0.0.0.0');
        tr.setInput('EndIpAddress', '255.255.255.255');

        // Mock packageUtility so getPackagePath returns the path as-is
        // (avoids glob resolution from the real webdeployment-common module).
        tr.registerMock('azure-pipelines-tasks-webdeployment-common/packageUtility.js', {
            PackageUtility: {
                getPackagePath: (p: string) => p
            }
        });

        let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "/usr/local/bin/mysql": "/usr/local/bin/mysql"
            },
            "checkPath": {
                "/usr/local/bin/mysql": true
            },
            "exec": {}
        };
        tr.setAnswers(a);
        tr.run();
    }
}

MysqlClientFileExecTests.startTests();
