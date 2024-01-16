import tl = require('azure-pipelines-task-lib/task');
import { testInvoker } from './automatedTestInvoker'
import { TestPlanData, getAutomatedTestData } from './getAutomatedTests';
import { TestCase } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';


export async function automatedTestsFlow() {

    let testsToBeExecuted: string[] = [];

    console.log(tl.loc('automatedTestsTriggered'));
    await getFQNsOfAutomatedTestCases()
        .then((testsToBeExecuted) => {
        })
        .catch((error) => {
            console.error("Promise rejected:", error);
        });

    await sleep(2000);
    tl.debug("Invoking test execution for tests: " + testsToBeExecuted);
    testInvoker(testsToBeExecuted);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getFQNsOfAutomatedTestCases(): Promise<string[]>{

    let testpointidslist: number[];
    let fqnlist: string[];

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

    await getAutomatedTestData(testPlan, testSuites, testPlanConfigId)
        .then((testPlanData) => {
                testpointidslist = testPlanData.testPointIds;
                fqnlist = testPlanData.listOfFQNOfTestCases;
        })
        .catch((error) => {
            console.error("Promise rejected:", error);
        });

    return fqnlist;
}

