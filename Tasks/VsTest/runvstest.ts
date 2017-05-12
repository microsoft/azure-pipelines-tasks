import * as tl from 'vsts-task-lib/task';
import * as models from './models';
import * as taskInputParser from './taskinputparser';
import * as localTest from './vstest';
import * as path from 'path';
import * as distributedTest from './distributedtest';

try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType :' + parallelExecution);

    const testType = tl.getInput('testSelector');
    tl.debug('Value of Test Selector :' + testType);

    if ((parallelExecution && parallelExecution.toLowerCase() === 'multimachine')
         || testType.toLowerCase() === 'testplan' || testType.toLowerCase() === 'testrun') {

        tl._writeLine(tl.loc('distributedTestWorkflow'));
        tl._writeLine('======================================================');
        const dtaTestConfig = taskInputParser.getDistributedTestConfigurations();
        tl._writeLine('======================================================');

        const test = new distributedTest.DistributedTest(dtaTestConfig);
        test.runDistributedTest();
    } else {
        localTest.startTest();
    }
} catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);
}

