import * as tl from 'azure-pipelines-task-lib/task';
import { manualTestsFlow } from './manualTests'
import { getTestPlanData, TestPlanData } from './testPlanData'
import { automatedTestsFlow } from './automatedTests'

export async function run() {

    const testSelectorInput = tl.getInput('testSelector');
    console.log('Test Selector selected : ' + testSelectorInput);

    const testPlanInfo = await getTestPlanData();

    let manualTestFlowReturnCode = 0;
    let automatedTestFlowReturnCode = 0;

    // trigger manual, automated or both tests based on user's input
    if (testSelectorInput.includes('manualTests')) {
        manualTestFlowReturnCode = await manualTestsFlow(testPlanInfo);
    }
    if (testSelectorInput.includes('automatedTests')) {
        automatedTestFlowReturnCode = await automatedTestsFlow(testPlanInfo, testSelectorInput);
    }

    if( manualTestFlowReturnCode || automatedTestFlowReturnCode){
        tl.setResult(tl.TaskResult.Failed, "Faced error in execution.");
    }
}

run();
