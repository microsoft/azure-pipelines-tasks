import tl = require('vsts-task-lib/task');
import models = require('./models')
import taskInputParser = require('./taskInputParser')
import localTest = require('./vstest')
import path = require('path');
import distributedTest = require('./distributedTest')

try {
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType :' + parallelExecution);

    const testType = tl.getInput('testSelector');
    tl.debug('Value of Test Selector :' + parallelExecution);

    if ((parallelExecution && parallelExecution.toLowerCase() === 'multimachine')
         || testType.toLowerCase() === 'testplan' || testType.toLowerCase() === 'testrun') {
        tl.debug('Going to the DTA Flow..');
        tl.debug('***********************');
        
        var dtaTestConfig = null;
        if(parallelExecution && parallelExecution.toLowerCase() === 'multimachine') {
            dtaTestConfig = taskInputParser.getDistributedTestConfigurations(false);
        }
        else {
            dtaTestConfig = taskInputParser.getDistributedTestConfigurations(true);
        }

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

function getDtaInstanceId(): number {
    const taskInstanceIdString = tl.getVariable('DTA_INSTANCE_ID');
    let taskInstanceId: number = 1;
    if (taskInstanceIdString) {
        const instanceId: number = Number(taskInstanceIdString);
        if (!isNaN(instanceId)) {
            taskInstanceId = instanceId + 1;
        }
    }
    tl.setVariable('DTA_INSTANCE_ID', taskInstanceId.toString());
    return taskInstanceId;
}
