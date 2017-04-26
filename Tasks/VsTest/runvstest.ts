import * as tl from 'vsts-task-lib/task';
import * as models from './models';
import * as taskInputParser from './taskinputparser';
import * as localTest from './vstest';
import * as path from 'path';
import * as distributedTest from './distributedtest';

try {
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType :' + parallelExecution);

    const testType = tl.getInput('testSelector');
    tl.debug('Value of Test Selector :' + testType);

    if ((parallelExecution && parallelExecution.toLowerCase() === 'multimachine')
         || testType.toLowerCase() === 'testplan' || testType.toLowerCase() === 'testrun') {

        console.log(tl.loc('distributedTestWorkflow'));
        console.log('======================================================');
        const dtaTestConfig = taskInputParser.getDistributedTestConfigurations();
        console.log('======================================================');

        const test = new distributedTest.DistributedTest(dtaTestConfig);
        test.runDistributedTest();
    } else {
        localTest.startTest();
    }
} catch (error) {
    console.log('##vso[task.logissue type=error;TaskName=VSTest]' + error);
    tl.setResult(tl.TaskResult.Failed, error);
}

