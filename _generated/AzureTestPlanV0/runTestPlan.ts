import * as tl from 'azure-pipelines-task-lib/task';
import { manualTestsFlow } from './manualTests'
import { getTestPlanData, TestPlanData } from './testPlanData'
import { automatedTestsFlow } from './automatedTests'

export async function run() {

    const testSelectorInput = tl.getInput('testSelector');
    console.log('Test Selector selected : ' + testSelectorInput);

    const testPlanInfo = await getTestPlanData();

    // trigger manual, automated or both tests based on user's input
    if (testSelectorInput.includes('manualTests')) {
        await manualTestsFlow(testPlanInfo);
    }
    if (testSelectorInput.includes('automatedTests')) {
        await automatedTestsFlow(testPlanInfo, testSelectorInput);
    }
}

run();
