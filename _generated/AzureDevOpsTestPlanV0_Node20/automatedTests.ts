import tl = require('azure-pipelines-task-lib/task');
import { testInvoker } from './automatedTestInvoker'
import { TestPlanData, getAutomatedTestData } from './getAutomatedTests';
import { TestCase } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';


export async function automatedTestsFlow(testSelectorInput: string) {

    let ListOfTestsToBeExecuted: string[] = [];

    console.log(tl.loc('automatedTestsTriggered'));
    await getFQNsOfAutomatedTestCases()
        .then((testsToBeExecuted) => {
            ListOfTestsToBeExecuted = testsToBeExecuted;
        })
        .catch((error) => {
            console.error("Error while fetching FqnsOfAutomatedTestCases :", error);
        });

    tl.debug("Invoking test execution for tests: " + ListOfTestsToBeExecuted);

    if (ListOfTestsToBeExecuted !== null && ListOfTestsToBeExecuted !== undefined && ListOfTestsToBeExecuted.length > 0) {
        testInvoker(ListOfTestsToBeExecuted);
    }
    else {
        console.log("No automated tests found for given test plan inputs ");
        if (testSelectorInput === 'automatedTests') {
            tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnNoAutomatedTestsFound'));
        }
        else {
            tl.setResult(tl.TaskResult.Succeeded, "Successfully triggered manual test execution");
        }
    }

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
            console.error("Error while fetching Automated Test Cases Data :", error);
        });

    return fqnlist;
}

