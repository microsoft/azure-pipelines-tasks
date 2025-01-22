import tl = require('azure-pipelines-task-lib/task');
import { TestPlanData, ManualTestRunData } from '../testPlanData';
import { createManualTestResultsAsync, createManualTestRun, createManualTestRunAsync, getTestResultApiClient, prepareRunModel } from '../ApiHelper';
import { ciDictionary } from '../ciEventLogger';
import * as constant from '../constants';
import { SimpleTimer } from '../SimpleTimer';
import { IOperationResult } from '../Interface/AzureTestPlanTaskInterfaces';
import { TestCaseResult, TestRun } from 'azure-devops-node-api/interfaces/TestInterfaces';

export async function manualTestsFlow(testPlanInfo: TestPlanData, ciData: ciDictionary):Promise<IOperationResult> {

    let manualTestRun: ManualTestRunData = { testRunId: 0, runUrl: "" };
    let simpleTimer = new SimpleTimer(constant.MANUALTESTS_PUBLISHING);
    let manualFlowResult: IOperationResult = { returnCode: 0, errorMessage: "" };
    let projectId = tl.getVariable('System.TeamProjectId');

    simpleTimer.start();
    
    try {
        const testRunRequestBody = prepareRunModel(testPlanInfo);
        const testResultsApi = await getTestResultApiClient();

        tl.debug(`Creating test run for project Id: ${projectId}`);
        const testRunResponse:TestRun = await testResultsApi.createTestRun(
            testRunRequestBody,
            projectId)

        tl.debug(`Adding ${testPlanInfo.listOfManualTestPoints.length} manual test results to test run id: ${testRunResponse.id}`);

        const testResultsResponse:TestCaseResult[]= await testResultsApi.addTestResultsToTestRun(
            testPlanInfo.listOfManualTestPoints,
            projectId,
            testRunResponse.id);

        console.log("Test run created with id: ", testRunResponse.id);
        console.log("Test results created for run id: ", testResultsResponse[0].testRun);
        console.log('Test run url: ', manualTestRun.runUrl);
    }
    catch (error) {
        manualFlowResult.errorMessage = error.message || String(error);
        manualFlowResult.returnCode = 1;
    }
    finally{
        simpleTimer.stop(ciData);
    }

    return manualFlowResult;
}