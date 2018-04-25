import * as path from 'path';
import * as Q from 'q';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as models from './models';
import * as utils from './helpers';
import * as constants from './constants';
import * as os from 'os';
import * as ci from './cieventlogger';
import * as versionFinder from './versionfinder';
import { AreaCodes, ResultMessages } from './constants';
import * as inputdatacontract from './inputdatacontract';
const uuid = require('uuid');
const regedit = require('regedit');

export function getDistributedTestConfigurations() : inputdatacontract.InputDataContract {
    const inputDataContract = populateInputDataContract();
    inputDataContract.UseVsTestConsole = false;

    inputDataContract.DistributionSettings = <inputdatacontract.DistributionSettings>{};
    inputDataContract.DistributionSettings.NumberOfTestAgents = 1;
    const totalJobsInPhase = parseInt(tl.getVariable('SYSTEM_TOTALJOBSINPHASE'));
    if (!isNaN(totalJobsInPhase)) {
        inputDataContract.DistributionSettings.NumberOfTestAgents = totalJobsInPhase;
    }
    console.log(tl.loc('dtaNumberOfAgents', inputDataContract.DistributionSettings.NumberOfTestAgents));

    const distributionType = tl.getInput('distributionBatchType');

    if (distributionType && distributionType === 'basedOnTestCases') {
        inputDataContract.DistributionSettings.TestCaseLevelSlicingEnabled = true;
        // flow if the batch type = based on agents/custom batching
        const distributeByAgentsOption = tl.getInput('batchingBasedOnAgentsOption');
        if (distributeByAgentsOption && distributeByAgentsOption === 'customBatchSize') {
            const batchSize = parseInt(tl.getInput('customBatchSizeValue'));
            if (!isNaN(batchSize) && batchSize > 0) {
                inputDataContract.DistributionSettings.NumberOfTestCasesPerSlice = batchSize;
                console.log(tl.loc('numberOfTestCasesPerSlice', inputDataContract.DistributionSettings.NumberOfTestCasesPerSlice));
            } else {
                throw new Error(tl.loc('invalidTestBatchSize', batchSize));
            }
        }
        // by default we set the distribution = number of agents
    } else if (distributionType && distributionType === 'basedOnExecutionTime') {
        inputDataContract.DistributionSettings.TestCaseLevelSlicingEnabled = true;
        inputDataContract.DistributionSettings.IsTimeBasedSlicing = true;
        // flow if the batch type = based on agents/custom batching
        const batchBasedOnExecutionTimeOption = tl.getInput('batchingBasedOnExecutionTimeOption');
        if (batchBasedOnExecutionTimeOption && batchBasedOnExecutionTimeOption === 'customTimeBatchSize') {
            const batchExecutionTimeInSec = parseInt(tl.getInput('customRunTimePerBatchValue'));
            if (isNaN(batchExecutionTimeInSec) || batchExecutionTimeInSec <= 0) {
                throw new Error(tl.loc('invalidRunTimePerBatch', batchExecutionTimeInSec));
            }
            inputDataContract.DistributionSettings.RunTimePerSlice = batchExecutionTimeInSec;
            console.log(tl.loc('RunTimePerBatch', inputDataContract.DistributionSettings.RunTimePerSlice));
        }
    } else if (distributionType && distributionType === 'basedOnAssembly') {
        inputDataContract.DistributionSettings.TestCaseLevelSlicingEnabled = false;
    }

    // hydra: why is this still required?
    const useVsTestConsole = tl.getVariable('UseVsTestConsole');
    if (useVsTestConsole) {
        inputDataContract.UseVsTestConsole = utils.Helper.stringToBool(useVsTestConsole);
    }

    // hydra: this will have to be done after we get vstest version in the managed layer
    // // VsTest Console cannot be used for Dev14
    // if (inputDataContract.UseVsTestConsole === true && inputDataContract.vsTestVersion !== '15.0') {
    //     console.log(tl.loc('noVstestConsole'));
    //     dtaConfiguration.useVsTestConsole = 'false';
    // }

    inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = false;
    if (tl.getVariable('ProceedAfterAbortedTestCase') && tl.getVariable('ProceedAfterAbortedTestCase').toUpperCase() === 'TRUE') {
        inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = true;
    }
    tl.debug('ProceedAfterAbortedTestCase is set to : ' + inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase);

    inputDataContract.CollectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    inputDataContract.AccessToken = tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken'];
    inputDataContract.AgentName = tl.getVariable('Agent.MachineName') + '-' + tl.getVariable('Agent.Name') + '-' + tl.getVariable('Agent.Id');

    //hydra: change this input to be some unique run identifier
    inputDataContract.RunIdentifier = getRunIdentifier();

    //hydra: do we need
    //dtaEnvironment.dtaHostLogFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'DTAExecutionHost.exe.log');

    return inputDataContract;
}

function populateInputDataContract() : inputdatacontract.InputDataContract {
    const inputDataContract = {} as inputdatacontract.InputDataContract;

    inputDataContract.TestSelectionSettings = <inputdatacontract.TestSelectionSettings>{};
    inputDataContract.TestSelectionSettings.TestSelectionType = tl.getInput('testSelector').toLowerCase();

    switch (inputDataContract.TestSelectionSettings.TestSelectionType) {

        case 'testplan':
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings = <inputdatacontract.TestPlanTestSuiteSettings>{};
            console.log(tl.loc('testSelectorInput', tl.loc('testPlanSelector')));

            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.Testplan = parseInt(tl.getInput('testPlan'));
            console.log(tl.loc('testPlanInput', inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.Testplan));

            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestPlanConfigId = parseInt(tl.getInput('testConfiguration'));
            console.log(tl.loc('testplanConfigInput', inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestPlanConfigId));

            const testSuiteStrings = tl.getDelimitedInput('testSuite', ',', true);
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestSuites = new Array<number>();
            testSuiteStrings.forEach(element => {
                const testSuiteId = parseInt(element);
                console.log(tl.loc('testSuiteSelected', testSuiteId));
                inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestSuites.push(testSuiteId);
            });

            // hydra: Set this as the default test source filter in case of test plan test suite scenario in hydra. ['**\\*', '!**\\obj\\*'] Also confirm if this is required
            //tl.debug('Setting the test source filter for the Test plan : ' + testConfiguration.sourceFilter);
            break;

        case 'testassemblies':
            console.log(tl.loc('testSelectorInput', tl.loc('testAssembliesSelector')));

            inputDataContract.TestSelectionSettings.TestCaseFilter = tl.getInput('testFiltercriteria');
            console.log(tl.loc('testFilterCriteriaInput', inputDataContract.TestSelectionSettings.TestCaseFilter));
            break;

        case 'testrun':
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings = <inputdatacontract.TestPlanTestSuiteSettings>{};

            console.log(tl.loc('testSelectorInput', tl.loc('testRunSelector')));
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId = parseInt(tl.getInput('tcmTestRun'));

            if (inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId <= 0) {
                throw new Error(tl.loc('testRunIdInvalid', inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId));
            }

            console.log(tl.loc('testRunIdInput', inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId));

            // hydra: Set this as the default test source filter in case of test plan test suite scenario in hydra. ['**\\*', '!**\\obj\\*'] Also confirm if this is required
            // tl.debug('Setting the test source filter for the TestRun : ' + testConfiguration.sourceFilter);
            break;
    }

    inputDataContract.TestSelectionSettings.SearchFolder = tl.getInput('searchFolder');
    if (!utils.Helper.isNullOrWhitespace(inputDataContract.TestSelectionSettings.SearchFolder)) {
        inputDataContract.TestSelectionSettings.SearchFolder = path.resolve(inputDataContract.TestSelectionSettings.SearchFolder);
    }

    if (inputDataContract.TestSelectionSettings.SearchFolder && !utils.Helper.pathExistsAsDirectory(inputDataContract.TestSelectionSettings.SearchFolder)) {
        throw new Error(tl.loc('searchLocationNotDirectory', inputDataContract.TestSelectionSettings.SearchFolder));
    }
    console.log(tl.loc('searchFolderInput', inputDataContract.TestSelectionSettings.SearchFolder));

    inputDataContract.ExecutionSettings = <inputdatacontract.ExecutionSettings>{};

    inputDataContract.ExecutionSettings.SettingsFile = tl.getPathInput('runSettingsFile');
    if (!utils.Helper.isNullOrWhitespace(inputDataContract.ExecutionSettings.SettingsFile)) {
        inputDataContract.ExecutionSettings.SettingsFile = path.resolve(inputDataContract.ExecutionSettings.SettingsFile);
    }
    if (inputDataContract.ExecutionSettings.SettingsFile === tl.getVariable('System.DefaultWorkingDirectory')) {
        delete inputDataContract.ExecutionSettings.SettingsFile;
    }
    console.log(tl.loc('runSettingsFileInput', inputDataContract.ExecutionSettings.SettingsFile));

    inputDataContract.ExecutionSettings.OverridenParameters = tl.getInput('overrideTestrunParameters');

    inputDataContract.ExecutionSettings.AssemblyLevelParallelism = tl.getBoolInput('runInParallel');
    console.log(tl.loc('runInParallelInput', inputDataContract.ExecutionSettings.AssemblyLevelParallelism));

    // hydra: valid only for console flow
    //inputDataContract.ExecutionSettings.runTestsInIsolation = tl.getBoolInput('runTestsInIsolation');
    //console.log(tl.loc('runInIsolationInput', testConfiguration.runTestsInIsolation));

    // hydra: do we want to shoot this warning?
    // if (inputDataContract.runTestsInIsolation) {
    //     tl.warning(tl.loc('runTestInIsolationNotSupported'));
    // }

    logWarningForWER(tl.getBoolInput('uiTests'));

    // InputDataContract.TfsSpecificSettings
    inputDataContract.TfsSpecificSettings = <inputdatacontract.TfsSpecificSettings>{};
    inputDataContract.TfsSpecificSettings.BuildId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Build.Buildid')) ? null : Number(tl.getVariable('Build.Buildid'));
    inputDataContract.TfsSpecificSettings.BuildUri = tl.getVariable('Build.BuildUri');
    inputDataContract.TfsSpecificSettings.ReleaseId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Release.ReleaseId')) ? null : Number(tl.getVariable('Release.ReleaseId'));
    inputDataContract.TfsSpecificSettings.ReleaseUri = tl.getVariable('Release.ReleaseUri');


    // TIA stuff

    inputDataContract.ExecutionSettings.TiaSettings = <inputdatacontract.TiaSettings>{};

    inputDataContract.ExecutionSettings.TiaSettings.Enabled = tl.getBoolInput('runOnlyImpactedTests');
    inputDataContract.ExecutionSettings.TiaSettings.RebaseLimit = +tl.getInput('runAllTestsAfterXBuilds');

    inputDataContract.ExecutionSettings.TiaSettings.FileLevel = getTIALevel(tl.getVariable('tia.filelevel'));

    inputDataContract.ExecutionSettings.TiaSettings.SourcesDirectory = tl.getVariable('build.sourcesdirectory');
    inputDataContract.ExecutionSettings.TiaSettings.FilterPaths = tl.getVariable('TIA_IncludePathFilters');

    // hydra: inputDataContract.ExecutionSettings.TiaSettings.runIdFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    inputDataContract.TiaBaseLineBuildIdFile = path.join(os.tmpdir(), uuid.v1() + '.txt');

    //hydra: inputDataContract.ExecutionSettings.TiaSettings.responseFile = path.join(os.tmpdir(), uuid.v1() + '.txt');

    inputDataContract.UseNewCollector = false;
    const useNewCollector = tl.getVariable('tia.useNewCollector');
    if (useNewCollector && useNewCollector.toUpperCase() === 'TRUE') {
        inputDataContract.UseNewCollector = true;
    }

    const buildReason = tl.getVariable('Build.Reason');

    // https://www.visualstudio.com/en-us/docs/build/define/variables
    // PullRequest -> This is the case for TfsGit PR flow
    // CheckInShelveset -> This is the case for TFVC Gated Checkin
    if (buildReason && (buildReason === 'PullRequest' || buildReason === 'CheckInShelveset')) {
        // hydra: Should this become a first class input or should we identify if it is a pr flow from the managed layer? First class input
        inputDataContract.IsPrFlow = true;
    } else {
        inputDataContract.IsPrFlow = utils.Helper.stringToBool(tl.getVariable('tia.isPrFlow'));
    }
    inputDataContract.UseTestCaseFilterInResponseFile = utils.Helper.stringToBool(tl.getVariable('tia.useTestCaseFilterInResponseFile'));

    // User map file
    inputDataContract.ExecutionSettings.TiaSettings.UserMapFile = tl.getVariable('tia.usermapfile');

    // disable editing settings file to switch on data collector
    // hydra: make this first class input
    if (tl.getVariable('tia.disabletiadatacollector') && tl.getVariable('tia.disabletiadatacollector').toUpperCase() === 'TRUE') {
        inputDataContract.DisableEnablingDataCollector = true;
    } else {
        inputDataContract.DisableEnablingDataCollector = false;
    }

    inputDataContract.ExecutionSettings.CustomTestAdapters = tl.getInput('pathtoCustomTestAdapters');
    if (!utils.Helper.isNullOrWhitespace(inputDataContract.ExecutionSettings.CustomTestAdapters)) {
        inputDataContract.ExecutionSettings.CustomTestAdapters = path.resolve(inputDataContract.ExecutionSettings.CustomTestAdapters);
    }
    if (inputDataContract.ExecutionSettings.CustomTestAdapters &&
        !utils.Helper.pathExistsAsDirectory(inputDataContract.ExecutionSettings.CustomTestAdapters)) {
        throw new Error(tl.loc('pathToCustomAdaptersInvalid', inputDataContract.ExecutionSettings.CustomTestAdapters));
    }
    console.log(tl.loc('pathToCustomAdaptersInput', inputDataContract.ExecutionSettings.CustomTestAdapters));

    // hydra: console flow only
    //testConfiguration.otherConsoleOptions = tl.getInput('otherConsoleOptions');
    //console.log(tl.loc('otherConsoleOptionsInput', testConfiguration.otherConsoleOptions));\

    // hydra: enable this warning
    // if (dtaConfiguration.otherConsoleOptions) {
    //     tl.warning(tl.loc('otherConsoleOptionsNotSupported'));
    // }

    inputDataContract.ExecutionSettings.CodeCoverageEnabled = tl.getBoolInput('codeCoverageEnabled');
    console.log(tl.loc('codeCoverageInput', inputDataContract.ExecutionSettings.CodeCoverageEnabled));

    inputDataContract.TargetBinariesSettings = <inputdatacontract.TargetBinariesSettings>{};
    inputDataContract.TargetBinariesSettings.BuildConfig = tl.getInput('configuration');
    inputDataContract.TargetBinariesSettings.BuildPlatform = tl.getInput('platform');

    inputDataContract.TestReportingSettings = <inputdatacontract.TestReportingSettings>{};
    inputDataContract.TestReportingSettings.TestRunTitle = tl.getInput('testRunTitle');

    inputDataContract.TeamProject = tl.getVariable('System.TeamProject');


    // InputDataContract.TestSpecificSettings
    inputDataContract.TestSpecificSettings = <inputdatacontract.TestSpecificSettings>{};
    inputDataContract.TestSpecificSettings.TestCaseAccessToken = tl.getVariable('Test.TestCaseAccessToken');


    inputDataContract.ExecutionSettings.RerunSettings = <inputdatacontract.RerunSettings>{};
    // Rerun information
    inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests = tl.getBoolInput('rerunFailedTests');
    console.log(tl.loc('rerunFailedTests', inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests));

    const rerunType = tl.getInput('rerunType') || 'basedOnTestFailurePercentage';

    inputDataContract.ExecutionSettings.RerunSettings.RerunType = rerunType;

    // hydra: unravel the nestings
    if (rerunType === 'basedOnTestFailureCount') {
        const rerunFailedTestCasesMaxLimit = parseInt(tl.getInput('rerunFailedTestCasesMaxLimit'));
        if (!isNaN(rerunFailedTestCasesMaxLimit)) {
            inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTestCasesMaxLimit = rerunFailedTestCasesMaxLimit;
            console.log(tl.loc('rerunFailedTestCasesMaxLimit', inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTestCasesMaxLimit));
        } else {
            tl.warning(tl.loc('invalidRerunFailedTestCasesMaxLimit'));
        }
    } else {
        const rerunFailedThreshold = parseInt(tl.getInput('rerunFailedThreshold'));
        if (!isNaN(rerunFailedThreshold)) {
            inputDataContract.ExecutionSettings.RerunSettings.RerunFailedThreshold = rerunFailedThreshold;
            console.log(tl.loc('rerunFailedThreshold', inputDataContract.ExecutionSettings.RerunSettings.RerunFailedThreshold));
        } else {
            tl.warning(tl.loc('invalidRerunFailedThreshold'));
        }
    }

    const rerunMaxAttempts = parseInt(tl.getInput('rerunMaxAttempts'));
    if (!isNaN(rerunMaxAttempts)) {
        inputDataContract.ExecutionSettings.RerunSettings.RerunMaxAttempts = rerunMaxAttempts;
        console.log(tl.loc('rerunMaxAttempts', inputDataContract.ExecutionSettings.RerunSettings.RerunMaxAttempts));
    } else {
        tl.warning(tl.loc('invalidRerunMaxAttempts'));
    }

    const vsTestLocationMethod = tl.getInput('vstestLocationMethod');
    if (vsTestLocationMethod === utils.Constants.vsTestVersionString) {
        const vsTestVersion = tl.getInput('vsTestVersion');
        if (utils.Helper.isNullEmptyOrUndefined(vsTestVersion)) {
            console.log('vsTestVersion is null or empty');
            throw new Error('vsTestVersion is null or empty');
        } else if (vsTestVersion.toLowerCase() === 'toolsinstaller') {
            tl.debug('Trying VsTest installed by tools installer.');
            ci.publishEvent({ subFeature: 'ToolsInstallerSelected', isToolsInstallerPackageLocationSet: !utils.Helper.isNullEmptyOrUndefined(tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable)) });

            const vsTestPackageLocation = tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable);
            tl.debug('Path to VsTest from tools installer: ' + vsTestPackageLocation);

            // get path to vstest.console.exe
            const matches = tl.findMatch(vsTestPackageLocation, '**\\vstest.console.exe');
            if (matches && matches.length !== 0) {
                inputDataContract.VsTestConsolePath = path.dirname(matches[0]);

                // hydra: do this in dta exe host based on version of vstest.console.exe
                inputDataContract.ForcePlatformV2 = true;
            } else {
                utils.Helper.publishEventToCi(AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('toolsInstallerPathNotSet'), 1041, false);
                throw new Error(tl.loc('toolsInstallerPathNotSet'));
            }

            // if Tools installer is not there throw.
            if (utils.Helper.isNullOrWhitespace(inputDataContract.VsTestConsolePath)) {
                ci.publishEvent({ subFeature: 'ToolsInstallerInstallationError' });
                utils.Helper.publishEventToCi(AreaCodes.SPECIFIEDVSVERSIONNOTFOUND, 'Tools installer task did not complete successfully.', 1040, true);
                throw new Error(tl.loc('ToolsInstallerInstallationError'));
            }

            ci.publishEvent({ subFeature: 'ToolsInstallerInstallationSuccessful' });

        } else if ((vsTestVersion !== '15.0') && (vsTestVersion !== '14.0')
            && (vsTestVersion.toLowerCase() !== 'latest')) {
            throw new Error(tl.loc('vstestVersionInvalid', vsTestVersion));
        } else if (vsTestLocationMethod === utils.Constants.vsTestVersionString && vsTestVersion === '12.0') {
            throw (tl.loc('vs2013NotSupportedInDta'));
        } else {
            console.log(tl.loc('vsVersionSelected', vsTestVersion));

            getTestPlatformPath(inputDataContract);
            // hydra: find vs installation location here
        }
    } else {
        // hydra: should it be full path or directory above?
        inputDataContract.VsTestConsolePath = tl.getInput('vsTestLocation');
        console.log(tl.loc('vstestLocationSpecified', 'vstest.console.exe', inputDataContract.VsTestConsolePath));
    }

    // hydra: Maybe move all warnings to a diff function
    if (tl.getBoolInput('uiTests') && inputDataContract.ExecutionSettings.AssemblyLevelParallelism) {
        tl.warning(tl.loc('uitestsparallel'));
    }

    // InputDataContract.Logging
    inputDataContract.Logging = <inputdatacontract.Logging>{};
    inputDataContract.Logging.EnableConsoleLogs = true;
    if (utils.Helper.isDebugEnabled()) {
        inputDataContract.Logging.DebugLogging = true;
    }

    inputDataContract.VstestTaskInstanceIdentifier = uuid.v1();

    // hydra: do this in the managed layer
    // try {
    //     versionFinder.getVsTestRunnerDetails(testConfiguration);
    // } catch (error) {
    //     utils.Helper.publishEventToCi(AreaCodes.SPECIFIEDVSVERSIONNOTFOUND, error.message, 1039, true);
    //     throw error;
    // }

    inputDataContract.ExecutionSettings.IgnoreTestFailures = utils.Helper.stringToBool(tl.getVariable('vstest.ignoretestfailures'));

    // Get proxy details
    inputDataContract.ProxySettings = <inputdatacontract.ProxySettings>{};
    inputDataContract.ProxySettings.ProxyUrl = tl.getVariable('agent.proxyurl');
    inputDataContract.ProxySettings.ProxyUsername = tl.getVariable('agent.proxyusername');
    inputDataContract.ProxySettings.ProxyPassword = tl.getVariable('agent.proxypassword');
    inputDataContract.ProxySettings.ProxyBypassHosts = tl.getVariable('agent.proxybypasslist');

    return inputDataContract;
}

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
            tl.debug("Trying VsTest installed by tools installer.");
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
        }
        else if ((testConfiguration.vsTestVersion !== '15.0') && (testConfiguration.vsTestVersion !== '14.0')
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

async function logWarningForWER(runUITests: boolean) {
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

function isDontShowUIRegKeySet(regPath: string): Q.Promise<boolean> {
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

    var buildReason = tl.getVariable('Build.Reason');

    // https://www.visualstudio.com/en-us/docs/build/define/variables
    // PullRequest -> This is the case for TfsGit PR flow
    // CheckInShelveset -> This is the case for TFVC Gated Checkin
    if (buildReason && (buildReason === "PullRequest" || buildReason === "CheckInShelveset")) {
        tiaConfiguration.isPrFlow = "true";
    }
    else {
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

function getRunIdentifier(): string {
    let runIdentifier: string = '';
    const taskInstanceId = getDtaInstanceId();
    const dontDistribute = tl.getBoolInput('dontDistribute');
    const releaseId = tl.getVariable('Release.ReleaseId');
    const jobId = tl.getVariable('System.JobPositionInPhase');
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    const phaseId = utils.Helper.isNullEmptyOrUndefined(releaseId) ?
        tl.getVariable('System.PhaseId') : tl.getVariable('Release.DeployPhaseId');
    if ((!utils.Helper.isNullEmptyOrUndefined(parallelExecution) && parallelExecution.toLowerCase() === 'multiconfiguration')
        || dontDistribute) {
        runIdentifier = `${phaseId}/${jobId}/${taskInstanceId}`;
    } else {
        runIdentifier = `${phaseId}/${taskInstanceId}`;
    }

    return runIdentifier;
}

// hydra: rename function and maybe refactor and add logic inline
function getTIALevel(fileLevel: string) {
    if (fileLevel && fileLevel.toUpperCase() === 'FALSE') {
        return false;
    }
    return true;
}

function getTestPlatformPath(inputDataContract : inputdatacontract.InputDataContract) {
    let vsTestVersion = tl.getInput('vsTestVersion');
    if (vsTestVersion.toLowerCase() === 'latest') {
        // latest
        tl.debug('Searching for latest Visual Studio');
        const vstestconsole15Path = getVSTestConsole15Path();
        if (vstestconsole15Path) {
            vsTestVersion = '15.0';
            return vstestconsole15Path;
        }

        // fallback
        tl.debug('Unable to find an instance of Visual Studio 2017..');
        tl.debug('Searching for Visual Studio 2015..');
        vsTestVersion = '14.0';
        return getVSTestLocation(14);
    }

    const vsVersion: number = parseFloat(vsTestVersion);

    if (vsVersion === 15.0) {
        const vstestconsole15Path = getVSTestConsole15Path();
        if (vstestconsole15Path) {
            return vstestconsole15Path;
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    tl.debug('Searching for Visual Studio ' + vsVersion.toString());
    return getVSTestLocation(vsVersion);
}

function getVSTestConsole15Path(): string {
    const vswhereTool = tl.tool(path.join(__dirname, 'vswhere.exe'));
    vswhereTool.line('-version [15.0,16.0) -latest -products * -requires Microsoft.VisualStudio.PackageGroup.TestTools.Core -property installationPath');
    let vsPath = vswhereTool.execSync({ silent: true } as tr.IExecSyncOptions).stdout;
    vsPath = utils.Helper.trimString(vsPath);
    tl.debug('Visual Studio 15.0 or higher installed path: ' + vsPath);
    if (!utils.Helper.isNullOrWhitespace(vsPath)) {
        return path.join(vsPath, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'TestWindow');
    }
    return null;
}

function getVSTestLocation(vsVersion: number): string {
    const vsCommon: string = tl.getVariable('VS' + vsVersion + '0COMNTools');
    if (!vsCommon) {
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }
    return path.join(vsCommon, '..\\IDE\\CommonExtensions\\Microsoft\\TestWindow');
}