import tl = require('azure-pipelines-task-lib/task');
import { testInvoker } from './automatedTestInvoker';
import { TestPlanData } from './testPlanData';
import { publishAutomatedTestResult } from './publishAutomatedTests';
import { ciDictionary } from './ciEventLogger';
import { SimpleTimer } from './SimpleTimer';
import * as constant from './constants';

export async function automatedTestsFlow(testPlanInfo: TestPlanData, testSelectorInput: string, ciData: ciDictionary): Promise<number> {
  let listOfTestsToBeExecuted: string[] = testPlanInfo.listOfFQNOfTestCases;
  let testInvokerStatusCode = 0;

  if (listOfTestsToBeExecuted !== null && listOfTestsToBeExecuted !== undefined && listOfTestsToBeExecuted.length > 0) {
    tl.debug('Invoking test execution for tests: ' + listOfTestsToBeExecuted);

    var simpleTimer = new SimpleTimer(constant.AUTOMATED_EXECUTION);
    simpleTimer.start();
    try {
      testInvokerStatusCode = await testInvoker(listOfTestsToBeExecuted, ciData);
    } catch (err) {
      tl.debug(`Unable to invoke automated test execution. Err:( ${err} )`);
      testInvokerStatusCode = 1;
    }
    simpleTimer.stop(ciData);

    simpleTimer = new SimpleTimer(constant.AUTOMATED_PUBLISHING);
    simpleTimer.start();
    try {
      await publishAutomatedTestResult(JSON.stringify(testPlanInfo.listOfAutomatedTestPoints));
    } catch (err) {
      tl.error(`Error while publishing automated Test Results with err : ( ${err} )`);
      testInvokerStatusCode = 1;
    }
    simpleTimer.stop(ciData);

    tl.debug(`Execution Status Code for test Invoker: ${testInvokerStatusCode}`);
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
