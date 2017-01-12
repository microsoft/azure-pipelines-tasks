import tl = require('vsts-task-lib/task');
import distributedTest = require('./distributedTest')
import models = require('./models')
import taskInputParser = require('./taskInputParser')
import localTest = require('./localtest')
import path = require('path');

try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType is ' + parallelExecution);

    if (parallelExecution.toLowerCase() === 'multimachine') {
        tl.debug('Multi Agent is ON.. Run the distributed tests.....');
        tl.debug('**************************************************');
        const dtaTestConfig = taskInputParser.getDistributedTestConfigurations();
        const test = new distributedTest.DistributedTest(dtaTestConfig);
        test.runDistributedTest();
    } else {
        tl.debug('Multi Agent is OFF.. Run the tests locally........');
        tl.debug('**************************************************');
        localTest.startTest();
    }
} catch (error) {
    tl._writeLine('##vso[task.logissue type=error;code=' + error + ';TaskName=VSTest]');
    throw error;
}
