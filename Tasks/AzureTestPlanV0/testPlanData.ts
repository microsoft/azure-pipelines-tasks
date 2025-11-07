import tl = require('azure-pipelines-task-lib/task');
import apim = require('azure-devops-node-api');
import { TestCase } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';
import { PagedList } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import {TestCaseResult} from 'azure-devops-node-api/interfaces/TestInterfaces';
import constants = require('./Common/constants');
import { getVstsWepApi } from './Common/ApiHelper';
import { ciDictionary } from './Common/ciEventLogger';

export const personalAccessTokenRegexp = /^.{76}AZDO.{4}$/;

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

export async function getTestPlanData(ciData: ciDictionary): Promise<TestPlanData | null> {

    const testPlanDataResponse: TestPlanData = {
        listOfFQNOfTestCases: [],
        testPlanId: 0,
        testSuiteIds: [],
        testConfigurationId: 0,
        listOfManualTestPoints: [],
        listOfAutomatedTestPoints: []
    };

    const testRunId = parseInt(tl.getInput('testRunId'));
    const testPlanInputId = parseInt(tl.getInput('testPlan'));
    const testPlanConfigInputId = parseInt(tl.getInput('testConfiguration'));
    const testSuiteStrings = tl.getDelimitedInput('testSuite', ',', testRunId ? false : true);
    
    const testSuitesInputId = new Array<number>();
    testSuiteStrings.forEach(element => {
        const testSuiteId = parseInt(element);
        testSuitesInputId.push(testSuiteId);
    })

    console.log("Test Run Id: " + testRunId);
    console.log('Test Plan Id:' + testPlanInputId);
    console.log('Test Plan Configuration Id:' + testPlanConfigInputId);
    console.log('Test Suite Ids:' + testSuitesInputId);

    await getTestPlanDataPoints(testPlanInputId, testSuitesInputId, testPlanConfigInputId, testRunId)
        .then((testPlanData) => {
            testPlanDataResponse.listOfFQNOfTestCases = testPlanData.listOfFQNOfTestCases;
            testPlanDataResponse.testPlanId = testPlanInputId;
            testPlanDataResponse.testSuiteIds = testSuitesInputId;
            testPlanDataResponse.testConfigurationId = testPlanConfigInputId;
            testPlanDataResponse.listOfManualTestPoints = testPlanData.listOfManualTestPoints;
            testPlanDataResponse.listOfAutomatedTestPoints = testPlanData.listOfAutomatedTestPoints;
        })
        .catch((error) => {
            ciData.returnCode = 1;
            ciData.errorMessage = error.message || String(error);
            ciData.taskErrorMessage = tl.loc('ErrorFailTaskOnAPIFailure');
            return null;
        });

    return testPlanDataResponse;
}

export async function getTestPlanDataPoints(testPlanInputId: number, testSuitesInputId: number[], testPlanConfigInputId: number, testRunId: number): Promise<TestPlanData> {
    
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

    if (!testRunId && (testPlanInputId == 0 || testPlanConfigInputId == 0)) {
        return testPlanData;
    }

    let testCasesData: (TestCase | TestCaseResult)[] = [];

    if (testRunId) {
        const testCasesResponse = (await getTestCaseListAsync(testPlanInputId, 0, testPlanConfigInputId.toString(), token, testRunId)) as TestCaseResult[];
        for (let key in testCasesResponse) {
            if (testCasesResponse.hasOwnProperty(key)) {
                testCasesData.push(testCasesResponse[key]);
            }
        }
    }

    else {
        for (const testSuiteId of testSuitesInputId) {
            if (testSuiteId === 0) {
                continue;
            }

            do {
                try {
                    const testCasesResponse = (await getTestCaseListAsync(testPlanInputId, testSuiteId, testPlanConfigInputId.toString(), token, testRunId)) as PagedList<TestCase>;
                    if(testCasesResponse === null){
                        tl.debug("No respone while fetching Test cases List for test suite id: " + testSuiteId + " and test plan id: " + testPlanInputId
                            + " and test configuration id: " + testPlanConfigInputId + " with continuation token: " + token);
                        break;
                    }

                    token = testCasesResponse.continuationToken;

                    for (let key in testCasesResponse) {
                        if (testCasesResponse.hasOwnProperty(key)) {
                            testCasesData.push(testCasesResponse[key]);
                        }
                    }

                } catch (error) {
                    tl.debug("Error fetching test cases list: " + error);
                    token = undefined;
                }
            } while (token);
        }
    }

    testRunId ? populateTestPlanDataForTestRunSelector(testCasesData as TestCaseResult[], testPlanData) : populateTestPlanDataForTestPlanSelector(testCasesData as TestCase[], testPlanData);

    console.log("Total number of Automated Test point ids :" + testPlanData.listOfAutomatedTestPoints.length);
    console.log("Total number of Manual Test point ids :" + testPlanData.listOfManualTestPoints.length);
    return testPlanData;
}

export async function getTestCaseListAsync(testPlanId: number, testSuiteId: number, testConfigurationId: string, continuationToken: string, testRunId: number): Promise<PagedList<TestCase> | TestCaseResult[]>{

    let vsts: apim.WebApi = await getVstsWepApi();
    let testPlanApi = await vsts.getTestPlanApi();
    let testResultsApi = await vsts.getTestResultsApi();
    let projectId = tl.getVariable('System.TeamProjectId');

    if (testRunId) {
        tl.debug("Fetching test case list for test run:" + testRunId);
        return testResultsApi.getTestResults(projectId, testRunId);
    }

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

export function populateTestPlanDataForTestPlanSelector(testCasesData: TestCase[], testPlanData: TestPlanData): void {
    
    testCasesData.forEach(testCase => {
        let automatedTestName = '';
        let automatedTestStorage = '';
        let isManualTest = false;
        let revisionId = 0;

        for (const witField of testCase.workItem?.workItemFields || []) {
            const parsedWitField = JSON.parse(JSON.stringify(witField)); // Deep copy for safety

            if (parsedWitField[constants.AUTOMATED_TEST_NAME] !== undefined && parsedWitField[constants.AUTOMATED_TEST_NAME] !== null) {
                automatedTestName = parsedWitField[constants.AUTOMATED_TEST_NAME].toString();
                testPlanData.listOfFQNOfTestCases.push(automatedTestName);
            }

            if (parsedWitField[constants.AUTOMATED_TEST_STORAGE] !== undefined && parsedWitField[constants.AUTOMATED_TEST_STORAGE] !== null) {
                automatedTestStorage = parsedWitField[constants.AUTOMATED_TEST_STORAGE].toString();
            }

            if (parsedWitField[constants.AUTOMATION_STATUS] !== undefined && parsedWitField[constants.AUTOMATION_STATUS] !== null && parsedWitField[constants.AUTOMATION_STATUS] === constants.NOT_AUTOMATED) {
                isManualTest = true;
            }

            if (parsedWitField[constants.REVISION_ID] !== undefined && parsedWitField[constants.REVISION_ID] !== null) {
                revisionId = parseInt(parsedWitField[constants.REVISION_ID]);
            }
        }

        if (testCase.pointAssignments.length > 0) {
            let testCaseResult: TestCaseResult = {
                testPoint: {
                    id: testCase.pointAssignments[0].id.toString()
                },
                testCase: {
                    id: testCase.workItem.id.toString()
                },
                testCaseTitle: testCase.workItem.name,
                testCaseRevision: revisionId,
                owner: testCase.pointAssignments[0].tester,
                configuration: {
                    id: testCase.pointAssignments[0].configurationId.toString(),
                    name: testCase.pointAssignments[0].configurationName
                }
            }
            if (automatedTestName !== '' && automatedTestStorage !== '') {
                testCaseResult.automatedTestName = automatedTestName;
                testCaseResult.automatedTestStorage = automatedTestStorage;
                testCaseResult.state = "5";

                testPlanData.listOfAutomatedTestPoints.push(
                    testCaseResult
                );
            }
            if (isManualTest === true) {
                testPlanData.listOfManualTestPoints.push(
                    testCaseResult
                );
            }
        }
    });
}

export function populateTestPlanDataForTestRunSelector(testCasesData: TestCaseResult[], testPlanData: TestPlanData): void {

    testCasesData.forEach(testCase => {
        let automatedTestName = '';
        let automatedTestStorage = '';
        let isManualTest = false;
        let revisionId = 0;

        automatedTestName = testCase.automatedTestName;
        testPlanData.listOfFQNOfTestCases.push(automatedTestName);
        automatedTestStorage = testCase.automatedTestStorage;
        isManualTest = automatedTestName ? false : true;
        revisionId = testCase.revision;

        let testCaseResult: TestCaseResult = {
            testPoint: testCase.testPoint,
            testCase: testCase.testCase,
            testCaseTitle: testCase.testCaseTitle,
            testCaseRevision: testCase.testCaseRevision,
            owner: testCase.owner,
            configuration: testCase.configuration,
            testPlan: testCase.testPlan
        }

        if (automatedTestName !== '' && automatedTestStorage !== '') {
            testCaseResult.automatedTestName = automatedTestName;
            testCaseResult.automatedTestStorage = automatedTestStorage;
            testCaseResult.state = "5";

            testPlanData.listOfAutomatedTestPoints.push(
                testCaseResult
            );
        }

        if (isManualTest === true) {
            testPlanData.listOfManualTestPoints.push(
                testCaseResult
            );
        }
    });
}
