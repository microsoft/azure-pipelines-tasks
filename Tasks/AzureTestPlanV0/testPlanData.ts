import { Console } from "console";
import tl = require('azure-pipelines-task-lib/task');
import apim = require('azure-devops-node-api');
import { WorkItemDetails, TestCase } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';
import { PagedList } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import TestPlanInterfaces = require('azure-devops-node-api/interfaces/TestPlanInterfaces');
import VSSInterfaces = require('azure-devops-node-api/interfaces/common/VSSInterfaces');
import constants = require('./constants');

export interface TestPlanData {
    automatedTestPointIds: number[];
    listOfFQNOfTestCases: string[];
    manualTestPointIds: number[];
}

export async function getTestPlanData(): Promise<TestPlanData> {

    const testPlanDataResponse: TestPlanData =
    {
        automatedTestPointIds: [],
        listOfFQNOfTestCases: [],
        manualTestPointIds: []
    };

    const testPlan = parseInt(tl.getInput('testPlan'));
    const testPlanConfigId = parseInt(tl.getInput('testConfiguration'));
    const testSuiteStrings = tl.getDelimitedInput('testSuite', ',', true);
    const testSuites = new Array<number>();
    testSuiteStrings.forEach(element => {
        const testSuiteId = parseInt(element);
        testSuites.push(testSuiteId);
    })

    console.log('Test Plan Id:' + testPlan);
    console.log('Test Plan Configuration Id:' + testPlanConfigId);
    console.log('Test Suite Ids:' + testSuites);

    await getTestPlanDataPoints(testPlan, testSuites, testPlanConfigId)
        .then((testPlanData) => {
            testPlanDataResponse.automatedTestPointIds = testPlanData.automatedTestPointIds;
            testPlanDataResponse.listOfFQNOfTestCases = testPlanData.listOfFQNOfTestCases;
            testPlanDataResponse.manualTestPointIds = testPlanData.manualTestPointIds;
        })
        .catch((error) => {
            tl.error("Error while fetching Test Plan Data :" + error);
            tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnAPIFailure'));
        });

    return testPlanDataResponse;
}

export async function getTestPlanDataPoints(testPlanId: number, testSuiteIds: number[], testConfigurationId: number): Promise<TestPlanData> {
    
    const testPlanData: TestPlanData = { automatedTestPointIds: [], listOfFQNOfTestCases: [], manualTestPointIds:[] };
    let token = null;
    const AutomatedTestName = constants.AUTOMATED_TEST_NAME;
    const AutomatedTestStorage = constants.AUTOMATED_TEST_STORAGE;
    const AutomationStatus = constants.AUTOMATION_STATUS;
    

    if (testPlanId == 0 || testConfigurationId == 0) {
        return testPlanData;
    }

    for (const testSuiteId of testSuiteIds) {
        if (testSuiteId === 0) {
            continue;
        }

        let testCasesData: TestCase[] = [];

        do {
            try {
                let testCasesResponse = await fetchTestPlanList(testPlanId, testSuiteId, testConfigurationId.toString(), token);

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

            if (automatedTestName !== '' && automatedTestStorage !== '') {
                if (testCase.pointAssignments.length > 0) {
                    testPlanData.automatedTestPointIds.push(testCase.pointAssignments[0].id);
                }
            }

            if (isManualTest === true) {
                if (testCase.pointAssignments.length > 0) {
                    testPlanData.manualTestPointIds.push(testCase.pointAssignments[0].id);
                }
            }
        });

    }

    console.log("Automated Test point ids :", testPlanData.automatedTestPointIds);
    console.log("Manual Test point ids :", testPlanData.manualTestPointIds);

    return testPlanData;
}

export async function fetchTestPlanList(testPlanId: number, testSuiteId: number, testConfigurationId: string, continuationToken: string): Promise<PagedList<TestCase>> {

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
