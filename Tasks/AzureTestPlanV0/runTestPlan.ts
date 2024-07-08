import * as tl from 'azure-pipelines-task-lib/task';
import { manualTestsFlow } from './manualTests'
import { getTestPlanData, TestPlanData } from './testPlanData'
import { automatedTestsFlow } from './automatedTests'
import { publishEvent, ciDictionary } from './ciEventLogger';

export async function run() {

    const testSelectorInput = tl.getInput('testSelector');
    console.log('Test Selector selected : ' + testSelectorInput);

    var ciData: ciDictionary = {
        TestSelector: testSelectorInput,
        totalNumOfManualTestPoint: 0,
        totalNumOfAutomatedTestPoint: 0,
        totalNumOfTestSuites: 0
    }

    const testPlanInfo = await getTestPlanData();

    ciData.totalNumOfAutomatedTestPoint = testPlanInfo.listOfAutomatedTestPoints.length;
    ciData.totalNumOfManualTestPoint = testPlanInfo.listOfManualTestPoints.length;
    ciData.totalNumOfTestSuites = testPlanInfo.testSuiteIds.length;

    let manualTestFlowReturnCode = 0;
    let automatedTestFlowReturnCode = 0;

    // trigger manual, automated or both tests based on user's input
    if (testSelectorInput.includes('manualTests')) {
        manualTestFlowReturnCode = await manualTestsFlow(testPlanInfo, ciData);
        tl.debug(`Execution Status Code for Manual Test Flow is ${manualTestFlowReturnCode}`);
        ciData["manualTestFlowReturnCode"] = manualTestFlowReturnCode;
    }

    if (testSelectorInput.includes('automatedTests')) {
        automatedTestFlowReturnCode = await automatedTestsFlow(testPlanInfo, testSelectorInput, ciData);
        tl.debug(`Execution Status Code for Automated Test Flow is ${automatedTestFlowReturnCode}`);
        ciData["automatedTestFlowReturnCode"] = automatedTestFlowReturnCode;
    }

    if( manualTestFlowReturnCode || automatedTestFlowReturnCode){
        tl.setResult(tl.TaskResult.Failed, "Faced error in execution.");
    }

    publishEvent(ciData);
}

run();
