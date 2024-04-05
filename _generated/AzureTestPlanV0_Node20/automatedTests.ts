import tl = require('azure-pipelines-task-lib/task');
import { testInvoker } from './automatedTestInvoker'
import { TestPlanData } from './testPlanData'
import { publishAutomatedTestResult } from './publishAutomatedTests'


export async function automatedTestsFlow(testPlanInfo: TestPlanData, testSelectorInput: string) {

    let listOfTestsToBeExecuted: string[] = testPlanInfo.listOfFQNOfTestCases;

    console.log(tl.loc('automatedTestTriggered'));

    if (listOfTestsToBeExecuted !== null && listOfTestsToBeExecuted !== undefined && listOfTestsToBeExecuted.length > 0) {
        tl.debug("Invoking test execution for tests: " + listOfTestsToBeExecuted);
        await testInvoker(listOfTestsToBeExecuted);
        publishAutomatedTestResult(JSON.stringify(testPlanInfo.listOfAutomatedTestPoints));
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
