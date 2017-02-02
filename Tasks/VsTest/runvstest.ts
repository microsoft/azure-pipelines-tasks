import tl = require('vsts-task-lib/task');
import models = require('./models')
import taskInputParser = require('./taskInputParser')
import localTest = require('./vstest')
import path = require('path');
import distributedTest = require('./distributedTest')

try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType :' + parallelExecution);

    const testType = tl.getInput('testSelector');
    tl.debug('Value of Test Selector :' + parallelExecution);

    if (parallelExecution && parallelExecution.toLowerCase() === 'multimachine' || testType.toLowerCase() === 'testplan' || testType.toLowerCase() === 'testrun') {
        tl.debug('Going to the DTA Flow..');
        tl.debug('***********************');
        const dtaTestConfig = taskInputParser.getDistributedTestConfigurations();
        const test = new distributedTest.DistributedTest(dtaTestConfig);
        test.runDistributedTest();
    } else {
        tl.debug('Run the tests locally using vstest.console.exe....');
        tl.debug('**************************************************');
        localTest.startTest();
    }
} catch (error) {
    tl._writeLine('##vso[task.logissue type=error;code=' + error + ';TaskName=VSTest]');
    throw error;
}
