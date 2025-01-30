import tl = require('azure-pipelines-task-lib/task');
import { IOperationResult } from '../Interface/IOperationResult';
import { ciDictionary } from '../Common/ciEventLogger';
import { publishAutomatedTestResult } from '../Common/publishAutomatedTests';
import { SimpleTimer } from '../Common/SimpleTimer';
import { TestPlanData } from '../testPlanData';
import * as constant from '../Common/constants';
import { ITestExecutor } from '../Interface/ITestExecutor';
import { MavenTestExecutor } from '../Automated Flow/TestExecutors/MavenTestExecutor';
import { GradleTestExecutor } from './TestExecutors/GradleTestExecutor';
import { PythonTestExecutor } from './TestExecutors/PythonTestExecutor';

export async function newAutomatedTestsFlow(testPlanInfo: TestPlanData, testSelectorInput: string, ciData: ciDictionary): Promise<IOperationResult> {
    let listOfTestsToBeExecuted: string[] = testPlanInfo?.listOfFQNOfTestCases ?? [];
    let automatedTestInvokerResult: IOperationResult = { returnCode: 0, errorMessage: '' };
    const testLanguage = tl.getInput('testLanguageInput', true);
    let testExecutor: ITestExecutor = getTestExecutor(testLanguage);
    let listOfTestsToBeRan: string[] = [];
    if (listOfTestsToBeExecuted && listOfTestsToBeExecuted.length > 0) {
        automatedTestInvokerResult = await testExecutor.setup();

        if (automatedTestInvokerResult.returnCode === 0) {
            automatedTestInvokerResult = await testExecutor.discoverTests(listOfTestsToBeExecuted, ciData, listOfTestsToBeRan);

            if (automatedTestInvokerResult.returnCode === 0) {
                if (listOfTestsToBeRan.length === 0) {
                    return handleNoTestsFound(testSelectorInput);
                }

                automatedTestInvokerResult = await testExecutor.executeTests(listOfTestsToBeExecuted, ciData);
                if (automatedTestInvokerResult.returnCode === 0) {
                    automatedTestInvokerResult = await publishResults(testPlanInfo, ciData, automatedTestInvokerResult);
                }
            }   
        }
    } else {
        automatedTestInvokerResult = handleNoTestsFound(testSelectorInput);
    }

    return automatedTestInvokerResult;
}

function getTestExecutor(testLanguage: string): ITestExecutor{
    let testExecutor:ITestExecutor;
    switch (testLanguage) {
                case 'JavaMaven':
                    testExecutor = new MavenTestExecutor();
                    break;
    
                case 'JavaGradle':
                    testExecutor = new GradleTestExecutor();
                    break;
    
                case 'Python':
                    testExecutor = new PythonTestExecutor();
                    break;
    
                case 'Go':
                    break;
    
                case 'Jest':
                    break;
    
                default:
                    console.log('Invalid test Language Input selected.');
            }
    return testExecutor;
}

async function publishResults(testPlanInfo: TestPlanData, ciData: ciDictionary, automatedTestInvokerResult: IOperationResult): Promise<IOperationResult> {
    let publishingTimer = new SimpleTimer(constant.AUTOMATED_PUBLISHING);
    publishingTimer.start();

    try {
        await publishAutomatedTestResult(JSON.stringify(testPlanInfo.listOfAutomatedTestPoints));
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

