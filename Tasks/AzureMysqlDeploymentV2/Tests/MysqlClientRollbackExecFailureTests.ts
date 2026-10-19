import type { TaskResult } from 'azure-pipelines-task-lib/task';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

// FF-off counterpart of MysqlClientHardenedExecFailureTests.ts: proves the legacy,
// string-tokenized exec helper (_executeSqlScript) also surfaces a non-zero mysql exit
// code as a failure - the rollback suite otherwise only demonstrates success.
export class MysqlClientRollbackExecFailureTests {

    public static async startTests(): Promise<void> {
        const tr = new TaskMockRunner(path.join(__dirname, 'MysqlClientRollbackExecFailureL0Tests.js'));

        tr.setInput('ConnectedServiceName', 'DEMO_CONNECTED_SERVICE_NAME');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('SqlUsername', 'DEMO_SQL_USERNAME');
        tr.setInput('SqlPassword', 'DEMO_SQL_PASSWORD');
        tr.setInput('TaskNameSelector', 'InlineSqlTask');
        tr.setInput('SqlInline', 'SELECT 1;');

        const tl = await import('azure-pipelines-task-lib/task');
        // Explicitly mock the flag false (rather than leaving it unset), consistent
        // with the rest of the rollback suite.
        tr.registerMockExport('getPipelineFeature', (_featureName: string) => false);
        tr.registerMockExport('exec', async () => 2);
        tr.registerMockExport('setResult', (result: TaskResult, message: string) => {
            tl.setResult(result, message);
        });
        tr.run();
    }
}

MysqlClientRollbackExecFailureTests.startTests().catch((error: Error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
