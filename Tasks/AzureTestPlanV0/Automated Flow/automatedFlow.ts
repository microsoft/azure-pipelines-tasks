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
import { JestTestExecutor } from './TestExecutors/JestTestExecutor';

export async function newAutomatedTestsFlow(testPlanInfo: TestPlanData, testSelectorInput: string, ciData: ciDictionary): Promise<IOperationResult> {
    let listOfTestsFromTestPlan: string[] = testPlanInfo?.listOfFQNOfTestCases ?? [];
    let automatedTestInvokerResult: IOperationResult = { returnCode: 0, errorMessage: '' };
    let publishOperationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
    const testLanguage = tl.getInput('testLanguageInput', true);
    let testExecutor: ITestExecutor = getTestExecutor(testLanguage);
    let listOfTestsDiscovered: string[] = [];
    if (listOfTestsFromTestPlan.length > 0) {
        automatedTestInvokerResult = await testExecutor.setup();

        if (automatedTestInvokerResult.returnCode === 0) {
            automatedTestInvokerResult = await testExecutor.discoverTests(listOfTestsFromTestPlan, ciData, listOfTestsDiscovered);
            if (automatedTestInvokerResult.returnCode === 0) {
                if (listOfTestsDiscovered.length === 0) {
                    return handleNoTestsFound(testSelectorInput);
                }
                automatedTestInvokerResult = await testExecutor.executeTests(listOfTestsDiscovered, ciData);
                publishOperationResult = await publishResults(testPlanInfo, ciData, automatedTestInvokerResult);
            }   
        }
    } else {
        automatedTestInvokerResult = handleNoTestsFound(testSelectorInput);
    }
    if(automatedTestInvokerResult.returnCode !== 0 || publishOperationResult.returnCode !== 0){
        automatedTestInvokerResult.returnCode = 1;
        automatedTestInvokerResult.errorMessage = automatedTestInvokerResult.errorMessage + '/n' + publishOperationResult.errorMessage;
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
    
                case 'JavaScriptJest':
                    testExecutor = new JestTestExecutor();
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

