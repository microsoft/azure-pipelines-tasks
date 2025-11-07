import tl = require('azure-pipelines-task-lib/task');
import { TestPlanData, ManualTestRunData } from '../testPlanData';
import { getTestResultApiClient, prepareRunModel } from '../Common/ApiHelper';
import { ciDictionary } from '../Common/ciEventLogger';
import * as constant from '../Common/constants';
import { SimpleTimer } from '../Common/SimpleTimer';
import { IOperationResult } from '../Interface/IOperationResult';
import { TestCaseResult, TestRun } from 'azure-devops-node-api/interfaces/TestInterfaces';

export async function manualTestsFlow(testPlanInfo: TestPlanData, ciData: ciDictionary): Promise<IOperationResult> {
    let simpleTimer = new SimpleTimer(constant.MANUALTESTS_PUBLISHING);
    let manualFlowResult: IOperationResult = { returnCode: 0, errorMessage: "" };
    let projectId = tl.getVariable('System.TeamProjectId');

    simpleTimer.start();
    
    try {
        // Step 1: Get API client
        const testResultsApi = await getTestResultApiClient().catch(error => {
            throw new Error(`Failed to get API client: ${error.message}`);
        });

        // Step 2: Prepare and create test run
        const testRunRequestBody = prepareRunModel(testPlanInfo);
        tl.debug(`Creating test run for project Id: ${projectId}`);
        
        const testRunResponse: TestRun = await testResultsApi.createTestRun(
            testRunRequestBody,
            projectId
        ).catch(error => {
            throw new Error(`Failed to create test run: ${error.message}`);
        });

        if (!testRunResponse || !testRunResponse.id) {
            throw new Error('Test run creation failed: Invalid response');
        }

        // Step 3: Add test results
        tl.debug(`Adding ${testPlanInfo.listOfManualTestPoints.length} manual test results to test run id: ${testRunResponse.id}`);
        
        const testResultsResponse: TestCaseResult[] = await testResultsApi.addTestResultsToTestRun(
            testPlanInfo.listOfManualTestPoints,
            projectId,
            testRunResponse.id
        ).catch(error => {
            throw new Error(`Failed to add test results: ${error.message}`);
        });

        if (!testResultsResponse || testResultsResponse.length === 0) {
            throw new Error('No test results were created');
        }

        console.log("Test run created with id: ", testRunResponse.id);
        console.log("Test results created for run id: ", testResultsResponse[0].testRun.id);
        console.log('Test run url: ', testRunResponse.url);
    }
    catch (error) {
        manualFlowResult.returnCode = 1;
        manualFlowResult.errorMessage = `Manual test flow failed: ${error.message}`;
        
        if (error instanceof Error) {
            tl.debug(`Stack trace: ${error.stack}`);
        }
    }
    finally {
        simpleTimer.stop(ciData);
    }

    return manualFlowResult;
}