import tl = require('azure-pipelines-task-lib/task');
import { testInvoker } from './automatedTestInvoker';
import { TestPlanData } from './testPlanData';
import { publishAutomatedTestResult } from './publishAutomatedTests';

export async function automatedTestsFlow(testPlanInfo: TestPlanData, testSelectorInput: string): Promise<number> {
  let listOfTestsToBeExecuted: string[] = testPlanInfo.listOfFQNOfTestCases;
  let testInvokerStatusCode = 0;

  if (listOfTestsToBeExecuted !== null && listOfTestsToBeExecuted !== undefined && listOfTestsToBeExecuted.length > 0) {
    tl.debug('Invoking test execution for tests: ' + listOfTestsToBeExecuted);

    try {
      testInvokerStatusCode = await testInvoker(listOfTestsToBeExecuted);
    } catch (err) {
      tl.debug(`Unable to invoke automated test execution. Err:( ${err} )`);
    }

    try {
      await publishAutomatedTestResult(JSON.stringify(testPlanInfo.listOfAutomatedTestPoints));
    } catch (err) {
      tl.error(`Error while publishing automated Test Results with err : ( ${err} )`);
      return 1;
    }

    return testInvokerStatusCode;
  } else {
    console.log('No automated tests found for given test plan inputs ');
    if (testSelectorInput === 'automatedTests') {
      tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnNoAutomatedTestsFound'));
      return 1;
    } else {
      tl.setResult(tl.TaskResult.Succeeded, 'Successfully triggered manual test execution');
      return 0;
    }
  }
}
