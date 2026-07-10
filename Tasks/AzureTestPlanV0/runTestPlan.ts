import * as tl from 'azure-pipelines-task-lib/task';
import { manualTestsFlow } from './Manual Flow/manualTests';
import { getTestPlanData, TestPlanData } from './testPlanData';
import { automatedTestsFlow } from './OldAutomatedFlow/automatedTests';
import { publishEvent, ciDictionary } from './Common/ciEventLogger';
import { IOperationResult } from './Interface/IOperationResult';
import { newAutomatedTestsFlow } from './Automated Flow/automatedFlow';

function updateCiData(testSelectorInput: string, testPlanInfo: TestPlanData, ciData: ciDictionary) {
    ciData.TestSelector = testSelectorInput;
    ciData.totalNumOfManualTestPoint = testPlanInfo.listOfManualTestPoints.length;
    ciData.totalNumOfAutomatedTestPoint = testPlanInfo.listOfAutomatedTestPoints.length;
    ciData.totalNumOfTestSuites = testPlanInfo.testSuiteIds.length;
}

async function fetchTestPlanData(ciData: ciDictionary): Promise<TestPlanData | null> {
    try {
        return await getTestPlanData(ciData);
    } catch (err) {
        ciData.returnCode = 1;
        ciData.errorMessage = `Error in fetching test plan data: ${err}`;
        return null;
    }
}

async function executeTestFlows(testSelectorInput: string, testPlanInfo: TestPlanData, ciData: ciDictionary): Promise<IOperationResult> {
    const defaultResult: IOperationResult = { returnCode: 0, errorMessage: '' };
    let manualFlowResult: IOperationResult = { ...defaultResult };
    let automatedFlowResult: IOperationResult = { ...defaultResult };

    // Handle manual tests execution
    if (testSelectorInput.includes('manualTests')) {
        manualFlowResult = await executeManualTests(testPlanInfo, ciData);
    }

    // Handle automated tests execution
    if (testSelectorInput.includes('automatedTests')) {
        automatedFlowResult = await executeAutomatedTests(testPlanInfo, testSelectorInput, ciData);
    }

    // Handle errors and return results
    return handleOperationErrorsAndResults(manualFlowResult, automatedFlowResult, ciData);
}

async function executeManualTests(testPlanInfo: TestPlanData, ciData: ciDictionary): Promise<IOperationResult> {
    const result = await manualTestsFlow(testPlanInfo, ciData);
    tl.debug(`Execution Status Code for Manual Test Flow is ${result.returnCode}`);
    
    if (result.returnCode) {
        tl.debug(`Error in Manual Test Flow: ${result.errorMessage}`);
    }
    ciData.manualTestFlowReturnCode = result.returnCode;
    return result;
}

async function executeAutomatedTests(testPlanInfo: TestPlanData, testSelectorInput: string, ciData: ciDictionary): Promise<IOperationResult> {
    const disableNewAutomatedFlow = tl.getVariable('Disable_NewAutomatedFlow') === 'true';
    tl.debug(`The value of Disable_NewAutomatedFlow is: ${disableNewAutomatedFlow}`);

    const result = disableNewAutomatedFlow
        ? await automatedTestsFlow(testPlanInfo, testSelectorInput, ciData)
        : await newAutomatedTestsFlow(testPlanInfo, testSelectorInput, ciData);

    tl.debug(`Execution Status Code for Automated Test Flow is ${result.returnCode}`);
    ciData.automatedTestFlowReturnCode = result.returnCode;
    return result;
}

function handleOperationErrorsAndResults(manualResult: IOperationResult, automatedResult: IOperationResult, ciData: ciDictionary): IOperationResult {
    if (manualResult.returnCode && automatedResult.returnCode) {
        ciData.returnCode = 1;
        ciData.errorMessage = `${manualResult.errorMessage}\n${automatedResult.errorMessage}`;
        manualResult.errorMessage = ciData.errorMessage;
        return manualResult;
    }

    if (manualResult.returnCode) {
        ciData.returnCode = 1;
        ciData.errorMessage = manualResult.errorMessage;
        return manualResult;
    }

    if (automatedResult.returnCode) {
        ciData.returnCode = 1;
        ciData.errorMessage = automatedResult.errorMessage;
        return automatedResult;
    }

    return manualResult;
}

export async function run() {
    const testSelectorInput = tl.getInput('testSelector');
    console.log('Test Selector selected: ' + testSelectorInput);

    let ciData: ciDictionary = {
        TestSelector: testSelectorInput,
        totalNumOfManualTestPoint: 0,
        totalNumOfAutomatedTestPoint: 0,
        totalNumOfTestSuites: 0,
        result: '',
        errorMessage: ''
    };

    const testPlanInfo = await fetchTestPlanData(ciData);
    if (testPlanInfo === null) {
        publishEvent(ciData);
        tl.setResult(tl.TaskResult.Failed, ciData.errorMessage);
        return;
    }
    
    updateCiData(testSelectorInput, testPlanInfo, ciData);
    let operationResult: IOperationResult = await executeTestFlows(testSelectorInput, testPlanInfo, ciData);
    publishEvent(ciData);

    if (operationResult.returnCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, operationResult.errorMessage);
    }

}

run();