import tl = require('azure-pipelines-task-lib/task');
import { testInvoker } from './automatedTestInvoker';
import { TestPlanData } from '../testPlanData';
import { publishAutomatedTestResult } from '../Common/publishAutomatedTests';
import { ciDictionary } from '../Common/ciEventLogger';
import { SimpleTimer } from '../Common/SimpleTimer';
import * as constant from '../Common/constants';
import { IOperationResult } from '../Interface/IOperationResult';

export async function automatedTestsFlow(testPlanInfo: TestPlanData, testSelectorInput: string, ciData: ciDictionary): Promise<IOperationResult> {
    let listOfTestsToBeExecuted: string[] = testPlanInfo?.listOfFQNOfTestCases ?? [];
    let automatedTestInvokerResult: IOperationResult = { returnCode: 0, errorMessage: '' };

    if (listOfTestsToBeExecuted !== null && listOfTestsToBeExecuted !== undefined && listOfTestsToBeExecuted.length > 0) {
        automatedTestInvokerResult = await executeTests(listOfTestsToBeExecuted, ciData);
        
        if(!automatedTestInvokerResult.returnCode){
            automatedTestInvokerResult = await publishResults(testPlanInfo, ciData, automatedTestInvokerResult);
        }
    } else {
        automatedTestInvokerResult = handleNoTestsFound(testSelectorInput);
    }

    return automatedTestInvokerResult;
}

async function executeTests(listOfTestsToBeExecuted: string[], ciData: ciDictionary): Promise<IOperationResult> {
    let automatedTestInvokerResult: IOperationResult = { returnCode: 0, errorMessage: '' };
    let executionTimer = new SimpleTimer(constant.AUTOMATED_EXECUTION);

    tl.debug('Invoking test execution for tests: ' + listOfTestsToBeExecuted);
    executionTimer.start();

    try {
        automatedTestInvokerResult.returnCode = await testInvoker(listOfTestsToBeExecuted, ciData);
    } catch (err) {
        automatedTestInvokerResult.returnCode = 1;
        automatedTestInvokerResult.errorMessage = err.message || String(err);
    }
    finally{
        executionTimer.stop(ciData);
    }

    return automatedTestInvokerResult;
}

async function publishResults(testPlanInfo: TestPlanData, ciData: ciDictionary, automatedTestInvokerResult: IOperationResult): Promise<IOperationResult> {
    let publishingTimer = new SimpleTimer(constant.AUTOMATED_PUBLISHING);
    publishingTimer.start();

    try {
        await publishAutomatedTestResult(JSON.stringify(testPlanInfo.listOfAutomatedTestPoints), testPlanInfo.listOfAutomatedTestPoints.length ? testPlanInfo.listOfAutomatedTestPoints[0].testPlan?.id : "");
    } catch (err) {
        automatedTestInvokerResult.returnCode = 1;
        automatedTestInvokerResult.errorMessage = err.message || String(err);
    }
    finally{
        publishingTimer.stop(ciData);
    }

    return automatedTestInvokerResult;
}

function handleNoTestsFound(testSelectorInput: string): IOperationResult {
    if (testSelectorInput === 'automatedTests') {
        return { returnCode: 1, errorMessage: tl.loc('ErrorFailTaskOnNoAutomatedTestsFound') };
    } else {
        console.log('No automated tests found for given test plan inputs ');
        return { returnCode: 0, errorMessage: '' };
    }
}

