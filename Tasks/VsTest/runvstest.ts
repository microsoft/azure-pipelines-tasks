import * as tl from 'vsts-task-lib/task';
import * as models from './models';
import * as taskInputParser from './taskinputparser';
import * as localTest from './vstest';
import * as path from 'path';
import * as distributedTest from './distributedtest';
import * as ci from './cieventlogger';
import * as utils from './helpers';

//Starting the VsTest execution
const taskProps = { state: 'started', result: '' };
ci.publishEvent(taskProps);

try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    utils.Helper.setConsoleCodePage();
    const useDtaExecutionEngine = isDtaEngineRequired();
    if (useDtaExecutionEngine) {
        ci.publishEvent({
            runmode: 'distributedtest', parallelism: tl.getVariable('System.ParallelExecutionType'),
            testtype: tl.getInput('testSelector')
        });

        console.log(tl.loc('distributedTestWorkflow'));
        console.log('======================================================');
        const dtaTestConfig = taskInputParser.getDistributedTestConfigurations();
        console.log('======================================================');

        const test = new distributedTest.DistributedTest(dtaTestConfig);
        test.runDistributedTest();
    } else {
        ci.publishEvent({ runmode: 'vstest' });
        localTest.startTest();
    }
} catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);
    taskProps.result = error;
} finally {
    taskProps.state = 'completed';
    ci.publishEvent(taskProps);
}

function isDtaEngineRequired(): boolean {
    const batchType = tl.getInput('distributionBatchType');
    if (batchType && batchType === 'basedOnTestCases') {
        const batchSize = tl.getInput('batchingBasedOnAgentsOption');
        if (batchSize && batchSize === 'customBatchSize') {
            return true;
        }
    } else if (batchType && batchType === 'basedOnExecutionTime') {
        return true;
    } else if (batchType && batchType === 'basedOnAssembly') {
        return true;
    }

    const testType = tl.getInput('testSelector');
    tl.debug('Value of Test Selector :' + testType);
    if (testType.toLowerCase() === 'testplan' || testType.toLowerCase() === 'testrun') {
        return true;
    }

    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType :' + parallelExecution);

    if (parallelExecution && parallelExecution.toLowerCase() === 'multimachine') {
        const dontDistribute = tl.getBoolInput('dontDistribute');
        if(dontDistribute){
            return false;
        }
        return true;
    }

    return false;
}