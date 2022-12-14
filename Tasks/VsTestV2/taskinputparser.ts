import * as path from 'path';
import * as Q from 'q';
import * as tl from 'azure-pipelines-task-lib/task';
import * as models from './models';
import * as utils from './helpers';
import * as constants from './constants';
import * as ci from './cieventlogger';
import * as versionFinder from './versionfinder';
import { AreaCodes, ResultMessages } from './constants';
import * as uuid from 'uuid';
const regedit = require('regedit');

export function getvsTestConfigurations() {
    const vsTestConfiguration = {} as models.VsTestConfigurations;
    initTestConfigurations(vsTestConfiguration);
    vsTestConfiguration.isResponseFileRun = false;
    vsTestConfiguration.publishTestResultsInTiaMode = false;
    vsTestConfiguration.publishRunAttachments = tl.getInput('publishRunAttachments');
    vsTestConfiguration.vstestDiagFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    vsTestConfiguration.responseFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    vsTestConfiguration.vstestArgsFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    vsTestConfiguration.responseSupplementryFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    vsTestConfiguration.responseFileSupported = vsTestConfiguration.vsTestVersionDetails.isResponseFileSupported() || utils.Helper.isToolsInstallerFlow(vsTestConfiguration);
    return vsTestConfiguration;
}

function initDtaEnvironment(): models.DtaEnvironment {
    const dtaEnvironment = {} as models.DtaEnvironment;
    dtaEnvironment.tfsCollectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
    dtaEnvironment.patToken = tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken'];
    dtaEnvironment.agentName = tl.getVariable('Agent.MachineName') + '-' + tl.getVariable('Agent.Name') + '-' + tl.getVariable('Agent.Id');
    dtaEnvironment.environmentUri = getEnvironmentUri();
    dtaEnvironment.dtaHostLogFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'DTAExecutionHost.exe.log');
    return dtaEnvironment;
}

function getEnvironmentUri(): string {
    let environmentUri: string = '';

    const buildId = tl.getVariable('Build.BuildId');
    const releaseId = tl.getVariable('Release.ReleaseId');
    const projectName = tl.getVariable('System.TeamProject');
    const jobId = tl.getVariable('System.JobPositionInPhase');
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    const taskInstanceId = getDtaInstanceId();
    const dontDistribute = tl.getBoolInput('dontDistribute');
    const pipelineId = utils.Helper.isNullEmptyOrUndefined(releaseId) ? 'build'.concat(`/${buildId}`) : 'release'.concat(`/${releaseId}`);
    const phaseId = utils.Helper.isNullEmptyOrUndefined(releaseId) ?
        tl.getVariable('System.PhaseId') : tl.getVariable('Release.DeployPhaseId');

    if ((!utils.Helper.isNullEmptyOrUndefined(parallelExecution) && parallelExecution.toLowerCase() === 'multiconfiguration')
        || dontDistribute) {
        environmentUri = `vstest://env/${projectName}/_apis/${pipelineId}/${phaseId}/${jobId}/${taskInstanceId}`;
    } else {
        environmentUri = `vstest://env/${projectName}/_apis/${pipelineId}/${phaseId}/${taskInstanceId}`;
    }

    return environmentUri;
}

export function getDtaInstanceId(): number {
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

function initTestConfigurations(testConfiguration: models.TestConfigurations) {

    testConfiguration.testSelection = tl.getInput('testSelector');
    getTestSelectorBasedInputs(testConfiguration);

    testConfiguration.testDropLocation = tl.getInput('searchFolder');
    if (!utils.Helper.isNullOrWhitespace(testConfiguration.testDropLocation)) {
        testConfiguration.testDropLocation = path.resolve(testConfiguration.testDropLocation);
    }

    if (testConfiguration.testDropLocation && !utils.Helper.pathExistsAsDirectory(testConfiguration.testDropLocation)) {
        throw new Error(tl.loc('searchLocationNotDirectory', testConfiguration.testDropLocation));
    }
    console.log(tl.loc('searchFolderInput', testConfiguration.testDropLocation));

    testConfiguration.settingsFile = tl.getPathInput('runSettingsFile');
    if (!utils.Helper.isNullOrWhitespace(testConfiguration.settingsFile)) {
        testConfiguration.settingsFile = path.resolve(testConfiguration.settingsFile);
    }
    console.log(tl.loc('runSettingsFileInput', testConfiguration.settingsFile));

    testConfiguration.overrideTestrunParameters = tl.getInput('overrideTestrunParameters');

    testConfiguration.runInParallel = tl.getBoolInput('runInParallel');
    console.log(tl.loc('runInParallelInput', testConfiguration.runInParallel));

    testConfiguration.runTestsInIsolation = tl.getBoolInput('runTestsInIsolation');
    console.log(tl.loc('runInIsolationInput', testConfiguration.runTestsInIsolation));

    testConfiguration.runUITests = tl.getBoolInput('uiTests');
    logWarningForWER(testConfiguration.runUITests);
    testConfiguration.tiaConfig = getTiaConfiguration();

    testConfiguration.pathtoCustomTestAdapters = tl.getInput('pathtoCustomTestAdapters');
    if (!utils.Helper.isNullOrWhitespace(testConfiguration.pathtoCustomTestAdapters)) {
        testConfiguration.pathtoCustomTestAdapters = path.resolve(testConfiguration.pathtoCustomTestAdapters);
    }
    if (testConfiguration.pathtoCustomTestAdapters &&
        !utils.Helper.pathExistsAsDirectory(testConfiguration.pathtoCustomTestAdapters)) {
        throw new Error(tl.loc('pathToCustomAdaptersInvalid', testConfiguration.pathtoCustomTestAdapters));
    }

    console.log(tl.loc('pathToCustomAdaptersInput', testConfiguration.pathtoCustomTestAdapters));

    testConfiguration.otherConsoleOptions = tl.getInput('otherConsoleOptions');
    console.log(tl.loc('otherConsoleOptionsInput', testConfiguration.otherConsoleOptions));

    testConfiguration.codeCoverageEnabled = tl.getBoolInput('codeCoverageEnabled');
    console.log(tl.loc('codeCoverageInput', testConfiguration.codeCoverageEnabled));

    testConfiguration.diagnosticsConfiguration = getDiagnosticsConfiguration();
    console.log(tl.loc('diagnosticsInput', testConfiguration.diagnosticsConfiguration.enabled));    

    testConfiguration.buildConfig = tl.getInput('configuration');
    testConfiguration.buildPlatform = tl.getInput('platform');
    testConfiguration.testRunTitle = tl.getInput('testRunTitle');

    // Rerun information
    testConfiguration.rerunFailedTests = tl.getBoolInput('rerunFailedTests');
    console.log(tl.loc('rerunFailedTests', testConfiguration.rerunFailedTests));

    if (testConfiguration.rerunFailedTests) {
        parseRerunConfiguration();
    }

    testConfiguration.vsTestLocationMethod = tl.getInput('vstestLocationMethod');
    if (testConfiguration.vsTestLocationMethod === utils.Constants.vsTestVersionString) {
        testConfiguration.vsTestVersion = tl.getInput('vsTestVersion');
        if (utils.Helper.isNullEmptyOrUndefined(testConfiguration.vsTestVersion)) {
            console.log('vsTestVersion is null or empty');
            throw new Error('vsTestVersion is null or empty');
        }
        if (testConfiguration.vsTestVersion.toLowerCase() === 'toolsinstaller') {
            tl.debug('Trying VsTest installed by tools installer.');
            ci.publishEvent({ subFeature: 'ToolsInstallerSelected', isToolsInstallerPackageLocationSet: !utils.Helper.isNullEmptyOrUndefined(tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable)) });

            testConfiguration.toolsInstallerConfig = getToolsInstallerConfiguration();

            // if Tools installer is not there throw.
            if (utils.Helper.isNullOrWhitespace(testConfiguration.toolsInstallerConfig.vsTestPackageLocation)) {
                ci.publishEvent({ subFeature: 'ToolsInstallerInstallationError' });
                utils.Helper.publishEventToCi(AreaCodes.SPECIFIEDVSVERSIONNOTFOUND, 'Tools installer task did not complete successfully.', 1040, true);
                throw new Error(tl.loc('ToolsInstallerInstallationError'));
            }

            ci.publishEvent({ subFeature: 'ToolsInstallerInstallationSuccessful' });
            // if tools installer is there set path to vstest.console.exe and call getVsTestRunnerDetails
            testConfiguration.vsTestLocationMethod = utils.Constants.vsTestLocationString;
            testConfiguration.vsTestLocation = testConfiguration.toolsInstallerConfig.vsTestConsolePathFromPackageLocation;

            testConfiguration.toolsInstallerConfig.isToolsInstallerInUse = true;
        } else if ((testConfiguration.vsTestVersion !== '17.0') 
            && (testConfiguration.vsTestVersion !== '16.0') 
            && (testConfiguration.vsTestVersion !== '15.0') 
            && (testConfiguration.vsTestVersion !== '14.0')
            && (testConfiguration.vsTestVersion.toLowerCase() !== 'latest')) {
            throw new Error(tl.loc('vstestVersionInvalid', testConfiguration.vsTestVersion));
        }
        console.log(tl.loc('vsVersionSelected', testConfiguration.vsTestVersion));
    } else {
        testConfiguration.vsTestLocation = tl.getInput('vsTestLocation');
        console.log(tl.loc('vstestLocationSpecified', 'vstest.console.exe', testConfiguration.vsTestLocation));
    }

    if (tl.getBoolInput('uiTests') && testConfiguration.runInParallel) {
        tl.warning(tl.loc('uitestsparallel'));
    }

    testConfiguration.taskInstanceIdentifier = uuid.v1();

    try {
        versionFinder.getVsTestRunnerDetails(testConfiguration);
    } catch (error) {
        utils.Helper.publishEventToCi(AreaCodes.SPECIFIEDVSVERSIONNOTFOUND, error.message, 1039, true);
        throw error;
    }

    testConfiguration.ignoreTestFailures = tl.getVariable('vstest.ignoretestfailures');

    // Get proxy details
    testConfiguration.proxyConfiguration = getProxyConfiguration();

    function parseRerunConfiguration() {
        testConfiguration.rerunType = tl.getInput('rerunType') || 'basedOnTestFailurePercentage';

        if (testConfiguration.rerunType === 'basedOnTestFailureCount') {
            testConfiguration.rerunFailedTestCasesMaxLimit = 5; //default value in case of error
            const rerunFailedTestCasesMaxLimit = parseInt(tl.getInput('rerunFailedTestCasesMaxLimit'));
            if (!isNaN(rerunFailedTestCasesMaxLimit) && rerunFailedTestCasesMaxLimit > 0 && rerunFailedTestCasesMaxLimit <= 100) {
                testConfiguration.rerunFailedTestCasesMaxLimit = rerunFailedTestCasesMaxLimit;
                console.log(tl.loc('rerunFailedTestCasesMaxLimit', testConfiguration.rerunFailedTestCasesMaxLimit));
            } else {
                if (rerunFailedTestCasesMaxLimit === 0) {
                    tl.warning(tl.loc('disabledRerun', rerunFailedTestCasesMaxLimit));
                    testConfiguration.rerunFailedTests = false;
                    return;
                } else {
                    tl.warning(tl.loc('invalidRerunFailedTestCasesMaxLimit'));
                }
            }
        } else {
            testConfiguration.rerunFailedThreshold = 30; //default value in case of error
            const rerunFailedThreshold = parseInt(tl.getInput('rerunFailedThreshold'));
            if (!isNaN(rerunFailedThreshold) && rerunFailedThreshold > 0 && rerunFailedThreshold <= 100) {
                testConfiguration.rerunFailedThreshold = rerunFailedThreshold;
                console.log(tl.loc('rerunFailedThreshold', testConfiguration.rerunFailedThreshold));
            } else {
                if (rerunFailedThreshold === 0) {
                    tl.warning(tl.loc('disabledRerun', rerunFailedThreshold));
                    testConfiguration.rerunFailedTests = false;
                    return;
                } else {
                    tl.warning(tl.loc('invalidRerunFailedThreshold'));
                }
            }
        }
        testConfiguration.rerunMaxAttempts = 3; //default values incase of error
        const rerunMaxAttempts = parseInt(tl.getInput('rerunMaxAttempts'));
        if (!isNaN(rerunMaxAttempts) && rerunMaxAttempts > 0 && rerunMaxAttempts <= 10) {
            testConfiguration.rerunMaxAttempts = rerunMaxAttempts;
            console.log(tl.loc('rerunMaxAttempts', testConfiguration.rerunMaxAttempts));
        } else {
            tl.warning(tl.loc('invalidRerunMaxAttempts'));
        }
    }
}

function getProxyConfiguration(): models.ProxyConfiguration {
    const proxyConfiguration = {} as models.ProxyConfiguration;
    proxyConfiguration.proxyUrl = tl.getVariable("agent.proxyurl");
    proxyConfiguration.proxyUserName = tl.getVariable("agent.proxyusername");
    proxyConfiguration.proxyPassword = tl.getVariable("agent.proxypassword");
    proxyConfiguration.proxyBypassHosts = tl.getVariable("agent.proxybypasslist");
    return proxyConfiguration;
}

export async function logWarningForWER(runUITests: boolean) {
    if (!runUITests) {
        return;
    }

    const regPathHKLM = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting';
    const regPathHKCU = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting';

    const isEnabledInHKCU = await isDontShowUIRegKeySet(regPathHKCU);
    const isEnabledInHKLM = await isDontShowUIRegKeySet(regPathHKLM);

    if (!isEnabledInHKCU && !isEnabledInHKLM) {
        tl.warning(tl.loc('DontShowWERUIDisabledWarning'));
    }
}

export function isDontShowUIRegKeySet(regPath: string): Q.Promise<boolean> {
    const defer = Q.defer<boolean>();
    const regValue = 'DontShowUI';
    regedit.list(regPath).on('data', (entry) => {
        if (entry && entry.data && entry.data.values &&
            entry.data.values[regValue] && (entry.data.values[regValue].value === 1)) {
            defer.resolve(true);
        }
        defer.resolve(false);
    });
    return defer.promise;
}

function getTestSelectorBasedInputs(testConfiguration: models.TestConfigurations) {
    const testSelection = testConfiguration.testSelection.toLowerCase();
    switch (testSelection) {
        case 'testplan':
            console.log(tl.loc('testSelectorInput', tl.loc('testPlanSelector')));
            testConfiguration.testplan = parseInt(tl.getInput('testPlan'));
            console.log(tl.loc('testPlanInput', testConfiguration.testplan));

            testConfiguration.testPlanConfigId = parseInt(tl.getInput('testConfiguration'));
            console.log(tl.loc('testplanConfigInput', testConfiguration.testPlanConfigId));

            const testSuiteStrings = tl.getDelimitedInput('testSuite', ',', true);
            testConfiguration.testSuites = new Array<number>();
            testSuiteStrings.forEach(element => {
                const testSuiteId = parseInt(element);
                console.log(tl.loc('testSuiteSelected', testSuiteId));
                testConfiguration.testSuites.push(testSuiteId);
            });
            testConfiguration.sourceFilter = ['**\\*', '!**\\obj\\*'];
            tl.debug('Setting the test source filter for the Test plan : ' + testConfiguration.sourceFilter);
            break;
        case 'testassemblies':
            console.log(tl.loc('testSelectorInput', tl.loc('testAssembliesSelector')));
            testConfiguration.sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
            console.log(tl.loc('testAssemblyFilterInput', testConfiguration.sourceFilter));

            testConfiguration.testcaseFilter = tl.getInput('testFiltercriteria');
            console.log(tl.loc('testFilterCriteriaInput', testConfiguration.testcaseFilter));
            break;
        case 'testrun':
            console.log(tl.loc('testSelectorInput', tl.loc('testRunSelector')));
            testConfiguration.onDemandTestRunId = tl.getInput('tcmTestRun');
            if (parseInt(testConfiguration.onDemandTestRunId) <= 0) {
                throw new Error(tl.loc('testRunIdInvalid', testConfiguration.onDemandTestRunId));
            }
            console.log(tl.loc('testRunIdInput', testConfiguration.onDemandTestRunId));
            testConfiguration.sourceFilter = ['**\\*', '!**\\obj\\*'];
            tl.debug('Setting the test source filter for the TestRun : ' + testConfiguration.sourceFilter);
            break;
    }
}

function getDiagnosticsConfiguration(): models.DiagnosticsConfiguration {
    const diagnosticsConfiguration = {} as models.DiagnosticsConfiguration;
    // Diagnostics is not supported for non-api based local test run flows.
    diagnosticsConfiguration.enabled = false;
    return diagnosticsConfiguration;
}

function getTiaConfiguration(): models.TiaConfiguration {
    const tiaConfiguration = {} as models.TiaConfiguration;
    tiaConfiguration.tiaEnabled = tl.getBoolInput('runOnlyImpactedTests');
    tiaConfiguration.tiaRebaseLimit = tl.getInput('runAllTestsAfterXBuilds');
    tiaConfiguration.fileLevel = tl.getVariable('tia.filelevel');
    tiaConfiguration.sourcesDir = tl.getVariable('build.sourcesdirectory');
    tiaConfiguration.tiaFilterPaths = tl.getVariable('TIA_IncludePathFilters');
    tiaConfiguration.runIdFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    tiaConfiguration.baseLineBuildIdFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    tiaConfiguration.responseFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');

    tiaConfiguration.useNewCollector = false;

    const useNewCollector = tl.getVariable('tia.useNewCollector');
    if (useNewCollector && useNewCollector.toUpperCase() === 'TRUE') {
        tiaConfiguration.useNewCollector = true;
    }

    const buildReason = tl.getVariable('Build.Reason');

    // https://www.visualstudio.com/en-us/docs/build/define/variables
    // PullRequest -> This is the case for TfsGit PR flow
    // CheckInShelveset -> This is the case for TFVC Gated Checkin
    if (buildReason && (buildReason === 'PullRequest' || buildReason === 'CheckInShelveset')) {
        tiaConfiguration.isPrFlow = 'true';
    } else {
        tiaConfiguration.isPrFlow = tl.getVariable('tia.isPrFlow');
    }
    tiaConfiguration.useTestCaseFilterInResponseFile = tl.getVariable('tia.useTestCaseFilterInResponseFile');

    const releaseuri = tl.getVariable('release.releaseUri');
    tiaConfiguration.context = 'CI';
    if (releaseuri) {
        tiaConfiguration.context = 'CD';
    }

    // User map file
    tiaConfiguration.userMapFile = tl.getVariable('tia.usermapfile');

    // disable editing settings file to switch on data collector
    if (tl.getVariable('tia.disabletiadatacollector') && tl.getVariable('tia.disabletiadatacollector').toUpperCase() === 'TRUE') {
        tiaConfiguration.disableEnablingDataCollector = true;
    } else {
        tiaConfiguration.disableEnablingDataCollector = false;
    }

    return tiaConfiguration;
}

function getToolsInstallerConfiguration(): models.ToolsInstallerConfiguration {
    const toolsInstallerConfiguration = {} as models.ToolsInstallerConfiguration;

    tl.debug("Path to VsTest from tools installer: " + tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable));
    toolsInstallerConfiguration.vsTestPackageLocation = tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable);

    // get path to vstest.console.exe
    var matches = tl.findMatch(toolsInstallerConfiguration.vsTestPackageLocation, "**\\vstest.console.exe");
    if (matches && matches.length !== 0) {
        toolsInstallerConfiguration.vsTestConsolePathFromPackageLocation = matches[0];
    } else {
        utils.Helper.publishEventToCi(AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('toolsInstallerPathNotSet'), 1041, false);
        throw new Error(tl.loc('toolsInstallerPathNotSet'));
    }

    // get path to Microsoft.IntelliTrace.ProfilerProxy.dll (amd64)
    var amd64ProfilerProxy = tl.findMatch(toolsInstallerConfiguration.vsTestPackageLocation, "**\\amd64\\Microsoft.IntelliTrace.ProfilerProxy.dll");
    if (amd64ProfilerProxy && amd64ProfilerProxy.length !== 0) {
        toolsInstallerConfiguration.x64ProfilerProxyDLLLocation = amd64ProfilerProxy[0];
    } else {
        // Look in x64 also for Microsoft.IntelliTrace.ProfilerProxy.dll (x64)
        amd64ProfilerProxy = tl.findMatch(toolsInstallerConfiguration.vsTestPackageLocation, "**\\x64\\Microsoft.IntelliTrace.ProfilerProxy.dll");
        if (amd64ProfilerProxy && amd64ProfilerProxy.length !== 0) {
            toolsInstallerConfiguration.x64ProfilerProxyDLLLocation = amd64ProfilerProxy[0];
        } else {
            utils.Helper.publishEventToCi(AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1043, false);
            tl.warning(tl.loc('testImpactAndCCWontWork'));
        }

        utils.Helper.publishEventToCi(AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1042, false);
        tl.warning(tl.loc('testImpactAndCCWontWork'));
    }

    // get path to Microsoft.IntelliTrace.ProfilerProxy.dll (x86)
    var x86ProfilerProxy = tl.findMatch(toolsInstallerConfiguration.vsTestPackageLocation, "**\\x86\\Microsoft.IntelliTrace.ProfilerProxy.dll");
    if (x86ProfilerProxy && x86ProfilerProxy.length !== 0) {
        toolsInstallerConfiguration.x86ProfilerProxyDLLLocation = x86ProfilerProxy[0];
    } else {
        utils.Helper.publishEventToCi(AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1044, false);
        tl.warning(tl.loc('testImpactAndCCWontWork'));
    }

    return toolsInstallerConfiguration;
}

function getDistributionBatchSize(dtaTestConfiguration: models.DtaTestConfigurations) {
    const distributeOption = tl.getInput('distributionBatchType');
    if (distributeOption && distributeOption === 'basedOnTestCases') {
        dtaTestConfiguration.batchingType = models.BatchingType.TestCaseBased;
        // flow if the batch type = based on agents/custom batching
        const distributeByAgentsOption = tl.getInput('batchingBasedOnAgentsOption');
        if (distributeByAgentsOption && distributeByAgentsOption === 'customBatchSize') {
            const batchSize = parseInt(tl.getInput('customBatchSizeValue'));
            if (!isNaN(batchSize) && batchSize > 0) {
                dtaTestConfiguration.numberOfTestCasesPerSlice = batchSize;
                console.log(tl.loc('numberOfTestCasesPerSlice', dtaTestConfiguration.numberOfTestCasesPerSlice));
            } else {
                throw new Error(tl.loc('invalidTestBatchSize', batchSize));
            }
        }
        // by default we set the distribution = number of agents
    } else if (distributeOption && distributeOption === 'basedOnExecutionTime') {
        dtaTestConfiguration.batchingType = models.BatchingType.TestExecutionTimeBased;
        // flow if the batch type = based on agents/custom batching
        const batchBasedOnExecutionTimeOption = tl.getInput('batchingBasedOnExecutionTimeOption');
        if (batchBasedOnExecutionTimeOption && batchBasedOnExecutionTimeOption === 'customTimeBatchSize') {
            const batchExecutionTimeInSec = parseInt(tl.getInput('customRunTimePerBatchValue'));
            if (isNaN(batchExecutionTimeInSec) || batchExecutionTimeInSec <= 0) {
                throw new Error(tl.loc('invalidRunTimePerBatch', batchExecutionTimeInSec));
            }

            dtaTestConfiguration.runningTimePerBatchInMs = 60 * 1000;
            if (batchExecutionTimeInSec >= 60) {
                dtaTestConfiguration.runningTimePerBatchInMs = batchExecutionTimeInSec * 1000;
                console.log(tl.loc('RunTimePerBatch', dtaTestConfiguration.runningTimePerBatchInMs));
            } else {
                tl.warning(tl.loc('minimumRunTimePerBatchWarning', 60));
            }
        } else if (batchBasedOnExecutionTimeOption && batchBasedOnExecutionTimeOption === 'autoBatchSize') {
            dtaTestConfiguration.runningTimePerBatchInMs = 0;
        }
    } else if (distributeOption && distributeOption === 'basedOnAssembly') {
        dtaTestConfiguration.batchingType = models.BatchingType.AssemblyBased;
    }
    return 0;
}