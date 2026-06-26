import * as tl from 'azure-pipelines-task-lib/task';
import * as nondistributedtest from './nondistributedtest';
import * as path from 'path';
import * as distributedTest from './distributedtest';
import * as ci from './cieventlogger';
import * as utils from './helpers';
import * as inputParser from './inputparser';
import * as os from 'os';
import * as localtest from './vstest';
import * as versionFinder from './versionfinder';
import * as process from 'process';
import { InputDataContract } from './inputdatacontract';
import { ServerTypes, ActionOnThresholdNotMet, BackDoorVariables, AgentVariables, TcmServiceConstants } from './constants';

const request = require('request');
const osPlat: string = os.platform();

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function execute() {
    const taskProps: { [key: string]: string; } = { state: 'started'};
    ci.publishEvent(taskProps);

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

        const enableArm64Vstest = await isTcmFeatureFlagEnabled('TestExecution.EnableArm64VstestConsole');
        versionFinder.setVstestArm64Enabled(enableArm64Vstest);

        setUpConnectedServiceEnvironmentVariables();

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
            const enableHydra = isHydraFlowToBeEnabled(inputDataContract);
            const forceLocalForArm64 = shouldForceLocalFlowForArm64(inputDataContract);

            if (!forceLocalForArm64 && (enableHydra || inputDataContract.EnableSingleAgentAPIFlow || (inputDataContract.ExecutionSettings
                && inputDataContract.ExecutionSettings.RerunSettings
                && inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests))) {
                if (enableApiExecution) {
                    console.log('================== API Execution =====================');
                    inputDataContract.ExecutionSettings.TestPlatformExecutionMode = 'api';
                }
                const test = new nondistributedtest.NonDistributedTest(inputDataContract);
                test.runNonDistributedTest();
            } else {
                if (forceLocalForArm64) {
                    console.log('ARM64 agent detected with TestExecution.EnableArm64VstestConsole enabled. Routing through the local test execution flow so the ARM64 test runner can be used.');
                }
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

function isHydraFlowToBeEnabled(inputDataContract: InputDataContract) {
    try {
        if ((inputDataContract.ServerType && inputDataContract.ServerType.toLowerCase() === ServerTypes.HOSTED)) {

            tl.debug('Enabling Hydra flow since serverType is hosted.');
            return true;
        }

        if (tl.getVariable(BackDoorVariables.FORCE_HYDRA) && tl.getVariable(BackDoorVariables.FORCE_HYDRA).toLowerCase() === 'true') {

            tl.debug(`Enabling Hydra flow since ${BackDoorVariables.FORCE_HYDRA} build variable is set to true.`);
            return true;
        }

        if (inputDataContract.TestReportingSettings && inputDataContract.TestReportingSettings.ExecutionStatusSettings
            && !utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet)
            && inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet !== ActionOnThresholdNotMet.DONOTHING) {

            tl.debug('Enabling Hydra flow since the minimum test executed feature is being used.');
            return true;
        }

        if (inputDataContract.TestReportingSettings
            && !utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.TestResultsDirectory)
            && inputDataContract.TestReportingSettings.TestResultsDirectory.toLowerCase()
            !== path.join(tl.getVariable(AgentVariables.AGENT_TEMPDIRECTORY), 'TestResults').toLowerCase()) {

            tl.debug('Enabling Hydra flow since the override results directory feature is being used.');
            return true;
        }

    } catch (e) {
        tl.debug(`Unexpected error occurred while trying to check if hydra flow is enabled ${e}`);
        ci.publishEvent({'FailedToCheckIfHydraEnabled': 'true', 'Exception': e});
    }

    return false;
}

// Decides whether to route an otherwise Hydra-bound run through the local test
// execution flow so that the ARM64 vstest.console runner can be used. The local
// flow is the only path in this task that selects vstest.console.arm64.exe.
// To stay safe we only reroute when:
//   1. the TestExecution.EnableArm64VstestConsole feature flag is enabled,
//   2. the agent/machine architecture is ARM64, and
//   3. none of the Hydra-only capabilities are requested (rerun failed tests,
//      minimum-tests threshold, overridden results directory, single-agent API
//      flow) and the FORCE_HYDRA backdoor is not set.
// If any Hydra-only capability is in use we keep the existing host-driven flow.
function shouldForceLocalFlowForArm64(inputDataContract: InputDataContract): boolean {
    try {
        if (!versionFinder.isVstestArm64Enabled() || !versionFinder.isArm64Agent()) {
            return false;
        }

        if (tl.getVariable(BackDoorVariables.FORCE_HYDRA) && tl.getVariable(BackDoorVariables.FORCE_HYDRA).toLowerCase() === 'true') {
            return false;
        }

        if (inputDataContract.EnableSingleAgentAPIFlow) {
            return false;
        }

        if (inputDataContract.ExecutionSettings
            && inputDataContract.ExecutionSettings.RerunSettings
            && inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests) {
            return false;
        }

        if (inputDataContract.TestReportingSettings && inputDataContract.TestReportingSettings.ExecutionStatusSettings
            && !utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet)
            && inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet !== ActionOnThresholdNotMet.DONOTHING) {
            return false;
        }

        if (inputDataContract.TestReportingSettings
            && !utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.TestResultsDirectory)
            && inputDataContract.TestReportingSettings.TestResultsDirectory.toLowerCase()
                !== path.join(tl.getVariable(AgentVariables.AGENT_TEMPDIRECTORY), 'TestResults').toLowerCase()) {
            return false;
        }

        return true;
    } catch (e) {
        tl.debug(`Unexpected error occurred while deciding ARM64 local-flow routing ${e}`);
        return false;
    }
}

export function isFeatureFlagEnabled(collectionUri: string, featureFlag: string, token: string): Promise<boolean> {
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
            if (faModel && faModel.effectiveState) {
                state = ('on' === faModel.effectiveState.toLowerCase());
                tl.debug(' Final feature flag state: ' + state);
            }
            resolve(state);
        });
    });
}

// Checks a feature flag on the TCM service instead of the core/collection service.
// It resolves the collection url and access token internally, then resolves the TCM
// service url from the collection url and performs the standard feature flag lookup
// against that url.
export function isTcmFeatureFlagEnabled(featureFlag: string): Promise<boolean> {
    const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    const endpointAuth = tl.getEndpointAuthorization('SystemVssConnection', true);
    const token = endpointAuth && endpointAuth.parameters ? endpointAuth.parameters.AccessToken : undefined;

    if (!collectionUri || !token) {
        tl.debug('Unable to resolve collection url or access token; treating feature flag ' + featureFlag + ' as off.');
        return Promise.resolve(false);
    }

    return getTcmServiceUrl(collectionUri, token).then((tcmServiceUrl) => {
        if (!tcmServiceUrl) {
            tl.debug('Unable to resolve TCM service url; treating feature flag ' + featureFlag + ' as off.');
            return false;
        }
        console.log('Resolved TCM service url: ' + tcmServiceUrl);
        return isFeatureFlagEnabled(tcmServiceUrl, featureFlag, token);
    });
}

// Resolves the TCM service base url from the collection url using the location
// (resource areas) service. Returns undefined when it cannot be resolved.
function getTcmServiceUrl(collectionUri: string, token: string): Promise<string | undefined> {
    const options = {
        url: collectionUri + '/_apis/resourceAreas/' + TcmServiceConstants.ResourceAreaId + '?api-version=5.0-preview.1',
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };

    return new Promise((resolve) => {
        request(options, (err, res, resourceArea) => {
            if (err) {
                tl.debug('Unable to resolve TCM service url. Error:' + err.message);
                resolve(undefined);
                return;
            }
            if (resourceArea && resourceArea.locationUrl) {
                // Trim trailing slashes so the feature flag url is well formed.
                resolve(resourceArea.locationUrl.replace(/\/+$/, ''));
                return;
            }
            tl.debug('TCM resource area did not return a locationUrl.');
            resolve(undefined);
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

function setUpConnectedServiceEnvironmentVariables() {
    var connectedService = tl.getInput('ConnectedServiceName');
    if(connectedService) {
        var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, false);
        if (authScheme && authScheme.toLowerCase() == "workloadidentityfederation") {
            process.env.AZURESUBSCRIPTION_SERVICE_CONNECTION_ID = connectedService;
            process.env.AZURESUBSCRIPTION_CLIENT_ID = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            process.env.AZURESUBSCRIPTION_TENANT_ID = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
            tl.debug('Environment variables AZURESUBSCRIPTION_SERVICE_CONNECTION_ID,AZURESUBSCRIPTION_CLIENT_ID and AZURESUBSCRIPTION_TENANT_ID are set');
        }
        else {
            tl.debug('Connected service is not of type Workload Identity Federation');
        }
    }
    else {
        tl.debug('No connected service set');
    }
}

if (osPlat !== 'win32') {
    // Fail the task if os is not windows
    tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
} else {
    //Starting the VsTest execution
    execute();
}