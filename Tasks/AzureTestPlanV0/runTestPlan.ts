import * as tl from 'azure-pipelines-task-lib/task';
import { manualTestsFlow } from './Manual Flow/manualTests'
import { getTestPlanData, TestPlanData } from './testPlanData'
import { automatedTestsFlow } from './automatedTests'
import { publishEvent, ciDictionary } from './Common/ciEventLogger';
import { IOperationResult } from './Interface/AzureTestPlanTaskInterfaces';

function setupCiData(testSelectorInput: string, testPlanInfo: TestPlanData) {
    var ciData: ciDictionary = {
        TestSelector: testSelectorInput,
        totalNumOfManualTestPoint: testPlanInfo.listOfManualTestPoints.length,
        totalNumOfAutomatedTestPoint: testPlanInfo.listOfAutomatedTestPoints.length,
        totalNumOfTestSuites: testPlanInfo.testSuiteIds.length
    }

    return ciData;
}

export async function run() {

    const testSelectorInput = tl.getInput('testSelector');
    console.log('Test Selector selected : ' + testSelectorInput);

    var testPlanInfo: TestPlanData;
    try {
        testPlanInfo = await getTestPlanData();
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, `Error in fetching test plan data: ${err}`);
        return 1;
    }

    var ciData: ciDictionary = setupCiData(testSelectorInput, testPlanInfo);

    var manualFlowResult: IOperationResult;
    var automatedFlowResult: IOperationResult;

    // trigger manual, automated or both tests based on user's input
    if (testSelectorInput.includes('manualTests')) {
        manualFlowResult = await manualTestsFlow(testPlanInfo, ciData);
        tl.debug(`Execution Status Code for Manual Test Flow is ${manualFlowResult.returnCode}`);
        
        if(manualFlowResult.returnCode){
            tl.debug(`Error in Manual Test Flow: ${manualFlowResult.errorMessage}`);
        }
        ciData["manualTestFlowReturnCode"] = manualFlowResult.returnCode;
    }

    if (testSelectorInput.includes('automatedTests')) {
        automatedFlowResult = await automatedTestsFlow(testPlanInfo, testSelectorInput, ciData);
        tl.debug(`Execution Status Code for Automated Test Flow is ${automatedFlowResult.returnCode}`);
        ciData["automatedTestFlowReturnCode"] = automatedFlowResult.returnCode;
    }

    if( manualFlowResult.returnCode || automatedFlowResult.returnCode){
        tl.setResult(tl.TaskResult.Failed, "Faced error in execution.");
    }

    publishEvent(ciData);
}

run();