import tl = require('azure-pipelines-task-lib/task');
import { testExecutor } from './automatedTestInvoker'
import { getAutomatedTests } from './getAutomatedTests';

export function automatedTestsFlow() {
    console.log("Automated flow to be triggered");

    const testPlan = parseInt(tl.getInput('testPlan'));

    const testPlanConfigId = parseInt(tl.getInput('testConfiguration'));

    const testSuiteStrings = tl.getDelimitedInput('testSuite', ',', true);
    const testSuites = new Array<number>();
    testSuiteStrings.forEach(element => {

        const testSuiteId = parseInt(element);
        testSuites.push(testSuiteId);
    })
    
    console.log('test plan:' + testPlan);
    console.log('testPlanConfigId:' + testPlanConfigId);
    console.log('testSuites:' + testSuites);

    // get list of automated test methods for given test plan input
    const testsToBeExecuted = getAutomatedTests(testPlan, testSuites, testPlanConfigId);
    console.log('tests to be executed :' + testsToBeExecuted);

    // call the test executor 
    if (testsToBeExecuted.length > 0) {
        testExecutor(testsToBeExecuted);
    }
}

