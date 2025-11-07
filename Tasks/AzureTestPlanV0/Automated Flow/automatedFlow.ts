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
import { PlaywrightTestExecutor } from './TestExecutors/PlaywrightTestExecutor';
export async function newAutomatedTestsFlow(
    testPlanInfo: TestPlanData, 
    testSelectorInput: string, 
    ciData: ciDictionary
): Promise<IOperationResult> {

    const testLanguage = tl.getInput('testLanguageInput', true);
    if (!testLanguage) {
        return createErrorResult('Test language input is required');
    }

    const listOfTestsFromTestPlan = testPlanInfo?.listOfFQNOfTestCases ?? [];
    if (listOfTestsFromTestPlan.length === 0) {
        return handleNoTestsFound(testSelectorInput);
    }

    // Initialize test executor    
    const testExecutor = getTestExecutor(testLanguage.toLowerCase());

    if (!testExecutor) {
        return createErrorResult(`Test executor not found for test language: ${testLanguage}`);
    }

    try {
        // Execute test phases
        const executionResult = await executeTestPhases(
            testExecutor as ITestExecutor,
            listOfTestsFromTestPlan,
            testPlanInfo,
            ciData
        );

        return executionResult;
    } catch (error) {
        tl.debug(`Unexpected error in automated test flow: ${error.message}`);
        return createErrorResult(`Automated test flow failed: ${error.message}`);
    }
}

async function executeTestPhases(
    testExecutor: ITestExecutor,
    testsFromPlan: string[],
    testPlanInfo: TestPlanData,
    ciData: ciDictionary
): Promise<IOperationResult> {
    // Setup phase
    const setupResult = await testExecutor.setup();
    if (setupResult.returnCode !== 0) {
        tl.debug(`Setup failed: ${setupResult.errorMessage}`);
        return setupResult;
    }

    // Discovery phase
    const listOfTestsDiscovered: string[] = [];
    const discoveryResult = await testExecutor.discoverTests(
        testsFromPlan,
        ciData,
        listOfTestsDiscovered
    );

    if (discoveryResult.returnCode !== 0) {
        tl.debug(`Test discovery failed: ${discoveryResult.errorMessage}`);
        return discoveryResult;
    }

    if (listOfTestsDiscovered.length === 0) {
        return handleNoTestsFound('automatedTests');
    }

    // Execution phase
    const executionResult = await testExecutor.executeTests(
        listOfTestsDiscovered,
        ciData
    );

    // Publishing phase
    const publishResult = await publishResults(testPlanInfo, ciData);

    // Combine and return results
    return combineResults(executionResult, publishResult);
}

async function publishResults(
    testPlanInfo: TestPlanData,
    ciData: ciDictionary
): Promise<IOperationResult> {
    const publishingTimer = new SimpleTimer(constant.AUTOMATED_PUBLISHING);
    publishingTimer.start();

    const failTaskonFailureToPublish = tl.getBoolInput('failTaskOnFailureToPublishResults', false);
    const failOnMissingResultsFile = tl.getBoolInput('failTaskOnMissingResultsFile', false);

    try {
        if (!testPlanInfo?.listOfAutomatedTestPoints && failOnMissingResultsFile) {
            throw new Error('No automated test points available for publishing');
        }

        await publishAutomatedTestResult(
            JSON.stringify(testPlanInfo.listOfAutomatedTestPoints),
            testPlanInfo.listOfAutomatedTestPoints.length ? testPlanInfo.listOfAutomatedTestPoints[0].testPlan?.id : ""
        );
        return createSuccessResult();

    } catch (error) {
        if (failTaskonFailureToPublish) {
            return createErrorResult(`Publishing failed: ${error.message}`);
        }
        tl.debug(`Failed to publish test results: ${error.message} but continuing since failTaskOnFailureToPublishResults is set to false`);
        return createSuccessResult();
    } finally {
        publishingTimer.stop(ciData);
    }
}

function createErrorResult(message: string): IOperationResult {
    return { returnCode: 1, errorMessage: message };
}

function createSuccessResult(): IOperationResult {
    return { returnCode: 0, errorMessage: '' };
}

function combineResults(
    executionResult: IOperationResult,
    publishResult: IOperationResult
): IOperationResult {
    if (executionResult.returnCode !== 0 || publishResult.returnCode !== 0) {
        return {
            returnCode: 1,
            errorMessage: [executionResult.errorMessage, publishResult.errorMessage]
                .filter(Boolean)
                .join('\n')
        };
    }
    return createSuccessResult();
}

function getTestExecutor(testLanguage: string): ITestExecutor {
    switch (testLanguage) {
        case 'javamaven':
            return new MavenTestExecutor();
        case 'javagradle':
            return new GradleTestExecutor();
        case 'python':
            return new PythonTestExecutor();
        case 'javascriptjest':
            return new JestTestExecutor();
        case 'playwright': 
            return new PlaywrightTestExecutor();
        default:
            return null;
    }
}

function handleNoTestsFound(testSelectorInput: string): IOperationResult {
    if (testSelectorInput === 'automatedTests') {
        return createErrorResult(tl.loc('ErrorFailTaskOnNoAutomatedTestsFound'));
    }
    tl.warning('No automated tests found for given test plan input');
    return createSuccessResult();
}

