import type { TaskResult } from 'azure-pipelines-task-lib/task';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

// FF-on counterpart proving the exec-based hardened helper (_executeSqlScriptArgs,
// used for InlineSqlTask/database-creation) surfaces a non-zero mysql exit code as a
// failure, mirroring the spawn-based hardened file-exec failure coverage.
export class MysqlClientHardenedExecFailureTests {

    public static async startTests(): Promise<void> {
        const tr = new TaskMockRunner(path.join(__dirname, 'MysqlClientHardenedExecFailureL0Tests.js'));

        tr.setInput('ConnectedServiceName', 'DEMO_CONNECTED_SERVICE_NAME');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('SqlUsername', 'DEMO_SQL_USERNAME');
        tr.setInput('SqlPassword', 'DEMO_SQL_PASSWORD');
        tr.setInput('TaskNameSelector', 'InlineSqlTask');
        tr.setInput('SqlInline', 'SELECT 1;');

        const tl = await import('azure-pipelines-task-lib/task');
        tr.registerMockExport('getPipelineFeature', (featureName: string) =>
            featureName === 'EnableAzureMysqlDeploymentV2BinaryModeHardening');
        tr.registerMockExport('exec', async () => 2);
        tr.registerMockExport('setResult', (result: TaskResult, message: string) => {
            tl.setResult(result, message);
        });
        tr.run();
    }
}

MysqlClientHardenedExecFailureTests.startTests().catch((error: Error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
