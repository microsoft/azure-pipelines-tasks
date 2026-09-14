import tl = require('azure-pipelines-task-lib');
import { ISqlClient } from '../sql/ISqlClient';
import { MysqlClient } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';

/**
 * Verifies a bare "--" in SqlAdditionalArguments is rejected before the
 * mysql client runs. No mocked exec/spawn answer is registered, so a
 * regression that still invokes the client fails for a different reason
 * (unmatched exec answer) instead of passing silently.
 */
export class MysqlClientOptionTerminatorL0Tests {

    public static azureMysqlTaskParameter: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();
    public static sqlClient: ISqlClient = new MysqlClient(
        MysqlClientOptionTerminatorL0Tests.azureMysqlTaskParameter,
        'DEMO_MYSQL_SERVER',
        '/usr/local/bin/mysql'
    );

    public static async startL0Tests() {
        await MysqlClientOptionTerminatorL0Tests.rejectsOptionTerminator();
    }

    public static async rejectsOptionTerminator() {
        try {
            await MysqlClientOptionTerminatorL0Tests.sqlClient.executeSqlCommand();
            tl.setResult(tl.TaskResult.Failed, 'MysqlClientOptionTerminatorL0Tests.rejectsOptionTerminator: should have thrown but succeeded.');
        } catch (error) {
            // MysqlClient.ts's, so formatting may differ.
            if (error.message.indexOf('AdditionalArgumentsContainOptionTerminator') !== -1) {
                tl.setResult(tl.TaskResult.Succeeded, 'MysqlClientOptionTerminatorL0Tests.rejectsOptionTerminator should have passed.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'MysqlClientOptionTerminatorL0Tests.rejectsOptionTerminator: threw unexpected error: ' + error.message);
            }
        }
    }
}

MysqlClientOptionTerminatorL0Tests.startL0Tests();
