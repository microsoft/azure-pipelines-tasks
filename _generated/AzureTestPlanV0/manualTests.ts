import tl = require('azure-pipelines-task-lib/task');
import { TestPlanData, createManualTestRun, ManualTestRunData } from './testPlanData';

export async function manualTestsFlow(testPlanInfo: TestPlanData) {

    let manualTestRun: ManualTestRunData = { testRunId: 0, runUrl: "" };

    manualTestRun = await createManualTestRun(testPlanInfo);

    console.log('Test run id created: ', manualTestRun.testRunId);
    console.log('Test run url: ', manualTestRun.runUrl);

}