import tl = require('azure-pipelines-task-lib');
import { MysqlClient } from '../sql/MysqlClient';
import { MysqlTaskParameter } from '../models/MysqlTaskParameter';

// Drives the real, unmodified MysqlClient against a mocked task.exec (wired up
// by the outer MysqlClientExecTests.ts wrapper via tr.registerMockExport),
// which asserts the exact argv and options passed on every invocation.
export class MysqlClientExecL0Tests {
    public static async startTests() {
        try {
            const parameter = new MysqlTaskParameter();
            const client = new MysqlClient(parameter, '/usr/local/bin/mysql');
            const result = await client.executeSqlCommand();
            if (result === 0) {
                tl.setResult(tl.TaskResult.Succeeded, 'MysqlClientExecL0Tests.executeSqlCommand passed.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'MysqlClientExecL0Tests.executeSqlCommand returned ' + result + '.');
            }
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, 'MysqlClientExecL0Tests.executeSqlCommand threw: ' + error.message);
        }
    }
}

MysqlClientExecL0Tests.startTests();
