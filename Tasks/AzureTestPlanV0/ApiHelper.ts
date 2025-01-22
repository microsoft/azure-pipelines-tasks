import * as tl from 'azure-pipelines-task-lib';
import { TestPlanData, ManualTestRunData, personalAccessTokenRegexp } from './testPlanData';
import { RunCreateModel, TestCaseResult, TestRun } from 'azure-devops-node-api/interfaces/TestInterfaces';
import { ITestResultsApi } from 'azure-devops-node-api/TestResultsApi';
import * as apim from 'azure-devops-node-api';


export async function getVstsWepApi(): Promise<apim.WebApi> {
    let url = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
    let token = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);

    let auth = (token.length == 52 || personalAccessTokenRegexp.test(token)) ? apim.getPersonalAccessTokenHandler(token) : apim.getBearerHandler(token);
    let vsts: apim.WebApi = new apim.WebApi(url, auth);
    return vsts;
}
export async function createManualTestRun(testPlanInfo: TestPlanData): Promise<ManualTestRunData> {

    const manualTestRunResponse: ManualTestRunData = { testRunId: 0, runUrl: "" };

    const testRunRequestBody = prepareRunModel(testPlanInfo);

    try {

        let projectId = tl.getVariable('System.TeamProjectId');
        var testResultsApi = await getTestResultApiClient();

        let testRunResponse = await createManualTestRunAsync(testResultsApi, testRunRequestBody, projectId);
        console.log("Test run created with id: ", testRunResponse.id);

        let testResultsResponse = await createManualTestResultsAsync(testResultsApi, testPlanInfo.listOfManualTestPoints, projectId, testRunResponse.id);
        console.log("Test results created for run id: ", testResultsResponse[0].testRun);

        manualTestRunResponse.testRunId = testRunResponse.id;
        manualTestRunResponse.runUrl = testRunResponse.webAccessUrl;
    }

    catch (error) {
        tl.error("Error while creating manual test run :" + error);
        tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnCreateRunFailure'));
    }

    return manualTestRunResponse;
}

export function prepareRunModel(testPlanInfo: TestPlanData): RunCreateModel {

    // some create run params may change on based of requirement
    let buildId = tl.getVariable('Build.BuildId');
    let testPointIds: number[] = testPlanInfo.listOfManualTestPoints.map(testPoint => parseInt(testPoint.testPoint.id));
    let testPlanId = testPlanInfo.testPlanId;
    let testConfigurationId = testPlanInfo.testConfigurationId;

    const currentUtcTime = new Date().toUTCString();
    console.log("date:...", currentUtcTime);

    const testRunRequestBody: RunCreateModel = {
        automated: false,
        name: 'Manual test run',
        plan: { id: testPlanId.toString() },
        configurationIds: [testConfigurationId],
        pointIds: testPointIds,
        build: { id: buildId },
        iteration: "manual"
    };

    return testRunRequestBody;
}

export async function createManualTestResultsAsync(testResultsApi: ITestResultsApi, testResultsRequest: TestCaseResult[], projectId: string, testRunId: number): Promise<TestCaseResult[]> {
    tl.debug(`Adding ${testResultsRequest.length} manual test results to test run id: ${testRunId}`);
    return testResultsApi.addTestResultsToTestRun(
        testResultsRequest,
        projectId,
        testRunId);

}

export async function createManualTestRunAsync(testResultsApi: ITestResultsApi, testRunRequest: RunCreateModel, projectId): Promise<TestRun> {

    tl.debug(`Creating manual test run for project Id : ${projectId}`);
    return testResultsApi.createTestRun(
        testRunRequest,
        projectId);

}

export async function getTestResultApiClient() {

    let vsts = await getVstsWepApi();
    let testResultsApi = await vsts.getTestResultsApi();

    console.log("Test result api client created");
    return testResultsApi;
}

