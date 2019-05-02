import * as tl from 'azure-pipelines-task-lib/task';
import * as nondistributedtest from './nondistributedtest';
import * as path from 'path';
import * as distributedTest from './distributedtest';
import * as ci from './cieventlogger';
import * as utils from './helpers';
import * as inputParser from './inputparser';
import * as os from 'os';
import * as localtest from './vstest';

const request = require('request');
const osPlat: string = os.platform();

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function execute() {
    const taskProps: { [key: string]: string; } = { state: 'started'};
    ci.publishEvent(taskProps);

    const enableHydra = await isFeatureFlagEnabled(tl.getVariable('System.TeamFoundationCollectionUri'),
        'TestExecution.EnableHydra', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);

    const enableApiExecution = await isFeatureFlagEnabled(tl.getVariable('System.TeamFoundationCollectionUri'),
        'TestExecution.EnableTranslationApi', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);

    try {
        utils.Helper.setConsoleCodePage();
        const blockRun = isMultiConfigOnDemandRun();
        if (blockRun) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('MultiConfigNotSupportedWithOnDemand'));
        }
        const serverBasedRun = isServerBasedRun();
        inputParser.setIsServerBasedRun(serverBasedRun);

        const enableDiagnostics = await isFeatureFlagEnabled(tl.getVariable('System.TeamFoundationCollectionUri'),
        'TestExecution.EnableDiagnostics', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);
        inputParser.setEnableDiagnosticsSettings(enableDiagnostics);

        if (serverBasedRun) {
            ci.publishEvent({
                runmode: 'distributedtest', parallelism: tl.getVariable('System.ParallelExecutionType'),
                testtype: tl.getInput('testSelector')
            });
            console.log(tl.loc('distributedTestWorkflow'));
            console.log('======================================================');
            const inputDataContract = inputParser.parseInputsForDistributedTestRun();
            console.log('======================================================');
            const test = new distributedTest.DistributedTest(inputDataContract);
            test.runDistributedTest();
        } else {
            ci.publishEvent({ runmode: 'nondistributed' });
            console.log(tl.loc('nonDistributedTestWorkflow'));
            console.log('======================================================');
            const inputDataContract = inputParser.parseInputsForNonDistributedTestRun();
            if (enableHydra || inputDataContract.EnableSingleAgentAPIFlow || (inputDataContract.ExecutionSettings
                && inputDataContract.ExecutionSettings.RerunSettings
                && inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests)) {
                if (enableApiExecution) {
                    console.log('================== API Execution =====================');
                    inputDataContract.ExecutionSettings.TestPlatformExecutionMode = 'api';
                }
                const test = new nondistributedtest.NonDistributedTest(inputDataContract);
                test.runNonDistributedTest();
            } else {
                localtest.startTest();
            }
            console.log('======================================================');
        }
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
        taskProps.result = error.message;
    }
    finally {
        taskProps.state = 'completed';
        ci.publishEvent(taskProps);
    }
}

function isFeatureFlagEnabled(collectionUri: string, featureFlag: string, token: string): Promise<boolean> {
    let state = false;
    const options = {
        url: collectionUri + '/_apis/FeatureFlags/' + featureFlag,
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };

    return new Promise((resolve, reject) => {
        request(options, (err, res, faModel) => {
            if (err) {
                tl.warning(tl.loc('UnableToGetFeatureFlag', featureFlag));
                tl.debug('Unable to get feature flag ' + featureFlag + ' Error:' + err.message);
                resolve(state);
            }
            if (faModel  && faModel.effectiveState) {
                state = ('on' === faModel.effectiveState.toLowerCase());
                tl.debug(' Final feature flag state: ' + state);
            }
            resolve(state);
        });
    });
}

function isMultiConfigOnDemandRun(): boolean {
    const testType = tl.getInput('testSelector');
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');

    if (testType && testType.toLowerCase() === 'testrun' && parallelExecution && parallelExecution.toLowerCase() === 'multiconfiguration') {
        return true;
    }

    return false;
}

function isServerBasedRun(): boolean {
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
        if (dontDistribute) {
            return false;
        }
        return true;
    }

    return false;
}

if (osPlat !== 'win32') {
    // Fail the task if os is not windows
    tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
} else {
    //Starting the VsTest execution
    execute();
}
