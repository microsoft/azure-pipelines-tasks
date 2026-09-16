import tl = require('azure-pipelines-task-lib');
import { ISqlClient } from '../sql/ISqlClient';
import { MysqlClient } from '../sql/MysqlClient';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';

/**
 * Verifies a bare "--" in SqlAdditionalArguments is rejected before the
 * mysql client runs. No mocked exec/spawn answer is registered for the
 * rejection scenarios, so a regression that still invokes the client fails
 * for a different reason (unmatched exec answer) instead of passing silently.
 */
export class MysqlClientOptionTerminatorL0Tests {

    public static azureMysqlTaskParameter: AzureMysqlTaskParameter = new AzureMysqlTaskParameter();
    public static sqlClient: ISqlClient = new MysqlClient(
        MysqlClientOptionTerminatorL0Tests.azureMysqlTaskParameter,
        'DEMO_MYSQL_SERVER',
        '/usr/local/bin/mysql'
    );

    // Builds a lightweight stand-in for AzureMysqlTaskParameter, overriding
    // only the fields a scenario needs.
    private static makeClient(overrides: { [key: string]: () => any }): ISqlClient {
        const param = {
            getSqlUserName: () => 'DEMO_SQL_USERNAME',
            getSqlPassword: () => 'DEMO_SQL_PASSWORD',
            getTaskNameSelector: () => 'InlineSqlTask',
            getSqlInline: () => 'SELECT 1;',
            getSqlFile: () => undefined,
            getDatabaseName: () => undefined,
            getSqlAdditionalArguments: () => '--skip-binary-mode --',
            ...overrides
        } as unknown as AzureMysqlTaskParameter;
        return new MysqlClient(param, 'DEMO_MYSQL_SERVER', '/usr/local/bin/mysql');
    }

    // Runs an action expected to throw the option-terminator rejection error.
    private static async expectRejected(testName: string, action: () => any) {
        try {
            await action();
            tl.setResult(tl.TaskResult.Failed, `MysqlClientOptionTerminatorL0Tests.${testName}: should have thrown but succeeded.`);
        } catch (error) {
            if (error.message.indexOf('AdditionalArgumentsContainOptionTerminator') !== -1) {
                tl.setResult(tl.TaskResult.Succeeded, `MysqlClientOptionTerminatorL0Tests.${testName} should have passed.`);
            } else {
                tl.setResult(tl.TaskResult.Failed, `MysqlClientOptionTerminatorL0Tests.${testName}: threw unexpected error: ${error.message}`);
            }
        }
    }

    // Runs an action expected to succeed (negative control).
    private static async expectAllowed(testName: string, action: () => any) {
        try {
            await action();
            tl.setResult(tl.TaskResult.Succeeded, `MysqlClientOptionTerminatorL0Tests.${testName} should have passed.`);
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, `MysqlClientOptionTerminatorL0Tests.${testName}: threw unexpected error: ${error.message}`);
        }
    }

    public static async startL0Tests() {
        await MysqlClientOptionTerminatorL0Tests.expectRejected(
            'rejectsOptionTerminator',
            () => MysqlClientOptionTerminatorL0Tests.sqlClient.executeSqlCommand()
        );

        // A bare "--" with no other arguments must also be rejected (not
        // just "--" following another flag).
        await MysqlClientOptionTerminatorL0Tests.expectRejected(
            'rejectsBareTerminatorAlone',
            () => MysqlClientOptionTerminatorL0Tests.makeClient({ getSqlAdditionalArguments: () => '--' }).executeSqlCommand()
        );

        // "--" followed by more tokens must still be rejected (not just a
        // trailing "--" at the end of the argument string).
        await MysqlClientOptionTerminatorL0Tests.expectRejected(
            'rejectsTerminatorWithTrailingTokens',
            () => MysqlClientOptionTerminatorL0Tests.makeClient({
                getSqlAdditionalArguments: () => '--skip-binary-mode -- --some-other-flag'
            }).executeSqlCommand()
        );

        // Negative control: "--" that only appears as part of a quoted
        // option value (not as its own token) must NOT be rejected.
        await MysqlClientOptionTerminatorL0Tests.expectAllowed(
            'allowsQuotedDoubleDashValue',
            () => MysqlClientOptionTerminatorL0Tests.makeClient({
                getSqlAdditionalArguments: () => '--default-character-set="--"'
            }).executeSqlCommand()
        );

        // The firewall-check path (getFirewallConfiguration) shares the
        // same additional-argument validation and must reject before ever
        // invoking task.execSync.
        await MysqlClientOptionTerminatorL0Tests.expectRejected(
            'rejectsOptionTerminatorInFirewallCheck',
            () => MysqlClientOptionTerminatorL0Tests.makeClient({}).getFirewallConfiguration()
        );

        // The file-based task path (SqlFile) shares the same
        // additional-argument validation and must reject before ever
        // attempting to spawn the client.
        await MysqlClientOptionTerminatorL0Tests.expectRejected(
            'rejectsOptionTerminatorForFileTask',
            () => MysqlClientOptionTerminatorL0Tests.makeClient({
                getTaskNameSelector: () => 'SqlFile',
                getSqlFile: () => '/tmp/does-not-matter.sql'
            }).executeSqlCommand()
        );
    }
}

MysqlClientOptionTerminatorL0Tests.startL0Tests();
