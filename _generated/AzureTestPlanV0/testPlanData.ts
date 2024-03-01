import { Console } from "console";
import tl = require('azure-pipelines-task-lib/task');
import apim = require('azure-devops-node-api');
import { WorkItemDetails, TestCase } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';
import { PagedList } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import TestPlanInterfaces = require('azure-devops-node-api/interfaces/TestPlanInterfaces');
import { RunCreateModel, TestRun, ShallowReference, TestPlan, TestCaseResult, TestResultCreateModel, TestCaseMetadata2, TestCaseReference2 } from 'azure-devops-node-api/interfaces/TestInterfaces';
import VSSInterfaces = require('azure-devops-node-api/interfaces/common/VSSInterfaces');
import constants = require('./constants');
import { ITestResultsApi } from "azure-devops-node-api/TestResultsApi";

export interface TestPlanData {
    listOfFQNOfTestCases: string[];
    testPlanId: number;
    testSuiteIds: number[];
    testConfigurationId: number;
    listOfManualTestPoints: TestCaseResult[];
    listOfAutomatedTestPoints: TestCaseResult[];
}

export interface ManualTestRunData {
    testRunId: number;
    runUrl: string;
}

export async function getTestPlanData(): Promise<TestPlanData> {

    const testPlanDataResponse: TestPlanData = {
        listOfFQNOfTestCases: [],
        testPlanId: 0,
        testSuiteIds: [],
        testConfigurationId: 0,
        listOfManualTestPoints: [],
        listOfAutomatedTestPoints: []
    };

    const testPlanInputId = parseInt(tl.getInput('testPlan'));
    const testPlanConfigInputId = parseInt(tl.getInput('testConfiguration'));
    const testSuiteStrings = tl.getDelimitedInput('testSuite', ',', true);
    const testSuitesInputId = new Array<number>();
    testSuiteStrings.forEach(element => {
        const testSuiteId = parseInt(element);
        testSuitesInputId.push(testSuiteId);
    })

    console.log('Test Plan Id:' + testPlanInputId);
    console.log('Test Plan Configuration Id:' + testPlanConfigInputId);
    console.log('Test Suite Ids:' + testSuitesInputId);

    await getTestPlanDataPoints(testPlanInputId, testSuitesInputId, testPlanConfigInputId)
        .then((testPlanData) => {
            testPlanDataResponse.listOfFQNOfTestCases = testPlanData.listOfFQNOfTestCases;
            testPlanDataResponse.testPlanId = testPlanInputId;
            testPlanDataResponse.testSuiteIds = testSuitesInputId;
            testPlanDataResponse.testConfigurationId = testPlanConfigInputId;
            testPlanDataResponse.listOfManualTestPoints = testPlanData.listOfManualTestPoints;
            testPlanDataResponse.listOfAutomatedTestPoints = testPlanData.listOfAutomatedTestPoints;
        })
        .catch((error) => {
            tl.error("Error while fetching Test Plan Data :" + error);
            tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnAPIFailure'));
        });

    return testPlanDataResponse;
}

export async function getTestPlanDataPoints(testPlanInputId: number, testSuitesInputId: number[], testPlanConfigInputId: number): Promise<TestPlanData> {
    
    const testPlanData: TestPlanData = {
        listOfFQNOfTestCases: [],
        testPlanId: 0,
        testSuiteIds: [],
        testConfigurationId: 0,
        listOfManualTestPoints: [],
        listOfAutomatedTestPoints: []
    };

    let token = null;
    const AutomatedTestName = constants.AUTOMATED_TEST_NAME;
    const AutomatedTestStorage = constants.AUTOMATED_TEST_STORAGE;

    if (testPlanInputId == 0 || testPlanConfigInputId == 0) {
        return testPlanData;
    }

    for (const testSuiteId of testSuitesInputId) {
        if (testSuiteId === 0) {
            continue;
        }

        let testCasesData: TestCase[] = [];

        do {
            try {
                let testCasesResponse = await getTestCaseListAsync(testPlanInputId, testSuiteId, testPlanConfigInputId.toString(), token);

                token = testCasesResponse.continuationToken;

                for (let key in testCasesResponse) {
                    if (testCasesResponse.hasOwnProperty(key)) {
                        testCasesData.push(testCasesResponse[key]);
                    }
                }

            } catch (error) {
                tl.error("Error fetching test cases list:" + error);
                token = undefined;
            }
        } while ((token !== undefined) && (token !== null));

        if (testCasesData.length === 0) {
            console.log(`No test cases for test suite ${testSuiteId}`);
            continue;
        }

        testCasesData.forEach(testCase => {
            let automatedTestName = '';
            let automatedTestStorage = '';
            let isManualTest = false;

            for (const witField of testCase.workItem?.workItemFields || []) {
                const parsedWitField = JSON.parse(JSON.stringify(witField)); // Deep copy for safety

                if (parsedWitField[constants.AUTOMATED_TEST_NAME] !== undefined && parsedWitField[constants.AUTOMATED_TEST_NAME] !== null) {
                    automatedTestName = parsedWitField[AutomatedTestName].toString();
                    testPlanData.listOfFQNOfTestCases.push(automatedTestName);
                }

                if (parsedWitField[constants.AUTOMATED_TEST_STORAGE] !== undefined && parsedWitField[constants.AUTOMATED_TEST_STORAGE] !== null) {
                    automatedTestStorage = parsedWitField[AutomatedTestStorage].toString();
                }

                if (parsedWitField[constants.AUTOMATION_STATUS] !== undefined && parsedWitField[constants.AUTOMATION_STATUS] !== null && parsedWitField[constants.AUTOMATION_STATUS] === constants.NOT_AUTOMATED) {
                    isManualTest = true;
                }
            }

            if(testCase.pointAssignments.length > 0) {
                let testCaseResult: TestCaseResult = {
                    testPoint: {
                        id: testCase.pointAssignments[0].id.toString()
                    },
                    testCase:{
                        id: testCase.workItem.id.toString()
                    },
                    testCaseTitle: testCase.workItem.name,
                    testCaseRevision: 1,
                    owner: testCase.pointAssignments[0].tester,
                    configuration: {
                        id: testCase.pointAssignments[0].configurationId.toString(),
                        name: testCase.pointAssignments[0].configurationName
                    }
                }
                if(automatedTestName !== '' && automatedTestStorage !== '') {
                    testCaseResult.automatedTestName = automatedTestName;
                    testCaseResult.automatedTestStorage = automatedTestStorage;
                    testCaseResult.state = "5";

                    testPlanData.listOfAutomatedTestPoints.push(
                        testCaseResult
                    );
                }
                if(isManualTest === true) {
                    testPlanData.listOfManualTestPoints.push(
                        testCaseResult
                    );
                }
            }
        });

    }

    console.log("Number of Automated Test point ids :", testPlanData.listOfAutomatedTestPoints.length);
    console.log("Number of Manual Test point ids :", testPlanData.listOfManualTestPoints.length);

    return testPlanData;
}

export async function getTestCaseListAsync(testPlanId: number, testSuiteId: number, testConfigurationId: string, continuationToken: string): Promise<PagedList<TestCase>> {

    let url = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
    let token = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    let projectId = tl.getVariable('System.TeamProjectId');
    let auth = token.length == 52 ? apim.getPersonalAccessTokenHandler(token) : apim.getBearerHandler(token);
    let vsts: apim.WebApi = new apim.WebApi(url, auth);
    let testPlanApi = await vsts.getTestPlanApi();

    tl.debug("Fetching test case list for test plan:" + testPlanId + " ,test suite id:" + testSuiteId + " ,test configuration id:" + testConfigurationId);

    return testPlanApi.getTestCaseList(
        projectId,
        testPlanId,
        testSuiteId,
        null,
        testConfigurationId,
        null,
        continuationToken)

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

    catch(error) {
        tl.error("Error while creating manual test run :" + error);
        tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnCreateRunFailure'));
    }

    return manualTestRunResponse;
}

export function prepareRunModel(testPlanInfo: TestPlanData): RunCreateModel{

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

export async function createManualTestResultsAsync(testResultsApi:ITestResultsApi, testResultsRequest: TestCaseResult[], projectId, testRunId): Promise<TestCaseResult[]> {
    return testResultsApi.addTestResultsToTestRun(
        testResultsRequest,
        projectId,
        testRunId)
    
}

export async function createManualTestRunAsync(testResultsApi:ITestResultsApi, testRunRequest: RunCreateModel, projectId): Promise<TestRun> {

    tl.debug("Creating manual test run");

    return testResultsApi.createTestRun(
        testRunRequest,
        projectId)

}

export async function getTestResultApiClient(){
    let url = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
    let token = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);

    let auth = token.length == 52 ? apim.getPersonalAccessTokenHandler(token) : apim.getBearerHandler(token);
    let vsts: apim.WebApi = new apim.WebApi(url, auth);
    let testResultsApi = await vsts.getTestResultsApi();

    console.log("Test result api client created");
    return testResultsApi;
}

