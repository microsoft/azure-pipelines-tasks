import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import * as utils from './helpers';
import * as constants from './constants';
import * as ci from './cieventlogger';
import { AreaCodes, DistributionTypes } from './constants';
import * as idc from './inputdatacontract';
import * as Q from "q";
import * as isUncPath from 'is-unc-path';
const regedit = require('regedit');

let serverBasedRun = false;
let enableDiagnosticsSettings = false;

// TODO: refactor all log messages to a separate function
// replace else if ladders with switch if possible
// unravel long else if chains

export function parseInputsForDistributedTestRun() : idc.InputDataContract {
    let inputDataContract = {} as idc.InputDataContract;

    inputDataContract = getTestSelectionInputs(inputDataContract);
    inputDataContract = getTfsSpecificSettings(inputDataContract);
    inputDataContract = getTargetBinariesSettings(inputDataContract);
    inputDataContract = getTestReportingSettings(inputDataContract);
    inputDataContract = getTestPlatformSettings(inputDataContract);
    inputDataContract = getLoggingSettings(inputDataContract);
    inputDataContract = getProxySettings(inputDataContract);
    inputDataContract = getDistributionSettings(inputDataContract);
    inputDataContract = getExecutionSettings(inputDataContract);

    inputDataContract.TeamProject = tl.getVariable('System.TeamProject');
    inputDataContract.CollectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    inputDataContract.AgentName = tl.getVariable('Agent.MachineName') + '-' + tl.getVariable('Agent.Name') + '-' + tl.getVariable('Agent.Id');
    inputDataContract.AccessTokenType = 'jwt';
    inputDataContract.RunIdentifier = getRunIdentifier();
    inputDataContract.SourcesDirectory = tl.getVariable('Build.SourcesDirectory');
    inputDataContract.ServerType = tl.getVariable('System.ServerType'); 

    logWarningForWER(tl.getBoolInput('uiTests'));
    ci.publishEvent({ 'UiTestsOptionSelected': tl.getBoolInput('uiTests')} );

    return inputDataContract;
}

export function parseInputsForNonDistributedTestRun() : idc.InputDataContract {
    let inputDataContract = {} as idc.InputDataContract;

    // hydra: should i create a separate function since testplan and testrun are never scenarios for local test?
    inputDataContract = getTestSelectionInputs(inputDataContract);
    inputDataContract = getTfsSpecificSettings(inputDataContract);
    inputDataContract = getTargetBinariesSettings(inputDataContract);
    inputDataContract = getTestReportingSettings(inputDataContract);
    inputDataContract = getTestPlatformSettings(inputDataContract);
    inputDataContract = getLoggingSettings(inputDataContract);
    inputDataContract = getProxySettings(inputDataContract);
    inputDataContract = getExecutionSettings(inputDataContract);

    inputDataContract.TeamProject = tl.getVariable('System.TeamProject');
    inputDataContract.CollectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    inputDataContract.AccessToken = tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken;
    inputDataContract.AccessTokenType = 'jwt';
    inputDataContract.AgentName = tl.getVariable('Agent.MachineName') + '-' + tl.getVariable('Agent.Name') + '-' + tl.getVariable('Agent.Id');
    inputDataContract.RunIdentifier = getRunIdentifier();
    inputDataContract.EnableSingleAgentAPIFlow = utils.Helper.stringToBool(tl.getVariable('Hydra.EnableApiFlow'));
    inputDataContract.SourcesDirectory = tl.getVariable('Build.SourcesDirectory');
    inputDataContract.ServerType = tl.getVariable('System.ServerType'); 

    logWarningForWER(tl.getBoolInput('uiTests'));

    return inputDataContract;
}

function getTestSelectionInputs(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    inputDataContract.TestSelectionSettings = <idc.TestSelectionSettings>{};
    inputDataContract.TestSelectionSettings.TestSelectionType = tl.getInput('testSelector').toLowerCase();
    switch (inputDataContract.TestSelectionSettings.TestSelectionType) {

        case 'testplan':
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings = <idc.TestPlanTestSuiteSettings>{};
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

            break;

        case 'testassemblies':
            console.log(tl.loc('testSelectorInput', tl.loc('testAssembliesSelector')));

            inputDataContract.TestSelectionSettings.TestCaseFilter = tl.getInput('testFiltercriteria');
            console.log(tl.loc('testFilterCriteriaInput', inputDataContract.TestSelectionSettings.TestCaseFilter));
            break;

        case 'testrun':
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings = <idc.TestPlanTestSuiteSettings>{};

            console.log(tl.loc('testSelectorInput', tl.loc('testRunSelector')));
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId = parseInt(tl.getInput('tcmTestRun'));

            if (inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId <= 0) {
                throw new Error(tl.loc('testRunIdInvalid', inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId));
            }
            console.log(tl.loc('testRunIdInput', inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId));

            break;
    }

    inputDataContract.TestSelectionSettings.SearchFolder = tl.getInput('searchFolder');
    if (!utils.Helper.isNullOrWhitespace(inputDataContract.TestSelectionSettings.SearchFolder)) {
        inputDataContract.TestSelectionSettings.SearchFolder = path.resolve(inputDataContract.TestSelectionSettings.SearchFolder);
    }

    if (inputDataContract.TestSelectionSettings.SearchFolder && !utils.Helper.pathExistsAsDirectory(inputDataContract.TestSelectionSettings.SearchFolder)) {
        throw new Error(tl.loc('searchLocationNotDirectory', inputDataContract.TestSelectionSettings.SearchFolder));
    }

    if (isUncPath(inputDataContract.TestSelectionSettings.SearchFolder)) {
        throw new Error(tl.loc('UncPathNotSupported'));
    }

    console.log(tl.loc('searchFolderInput', inputDataContract.TestSelectionSettings.SearchFolder));

    return inputDataContract;
}

function getTfsSpecificSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
        inputDataContract.TfsSpecificSettings = <idc.TfsSpecificSettings>{};
        inputDataContract.TfsSpecificSettings.BuildDefinitionId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Release.DefinitionId')) ? Number(tl.getVariable('System.DefinitionId')) : Number(tl.getVariable('Build.DefinitionId'));
        inputDataContract.TfsSpecificSettings.ReleaseDefinitionId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Release.DefinitionId')) ? null : Number(tl.getVariable('Release.DefinitionId'));
        inputDataContract.TfsSpecificSettings.BuildId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Build.Buildid')) ? null : Number(tl.getVariable('Build.Buildid'));
        inputDataContract.TfsSpecificSettings.BuildUri = tl.getVariable('Build.BuildUri');
        inputDataContract.TfsSpecificSettings.ReleaseId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Release.ReleaseId')) ? null : Number(tl.getVariable('Release.ReleaseId'));
        inputDataContract.TfsSpecificSettings.ReleaseUri = tl.getVariable('Release.ReleaseUri');
        inputDataContract.TfsSpecificSettings.ReleaseEnvironmentUri = tl.getVariable('Release.EnvironmentUri');
        inputDataContract.TfsSpecificSettings.WorkFolder = tl.getVariable('System.DefaultWorkingDirectory');
        inputDataContract.TfsSpecificSettings.PhaseName = tl.getVariable('System.PhaseName');
        inputDataContract.TfsSpecificSettings.PhaseAttempt = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('System.PhaseAttempt')) ? null : Number(tl.getVariable('System.PhaseAttempt'));
        inputDataContract.TfsSpecificSettings.StageName = tl.getVariable('System.StageName');
        inputDataContract.TfsSpecificSettings.StageAttempt = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('System.StageAttempt')) ? null : Number(tl.getVariable('System.StageAttempt'));
        inputDataContract.TfsSpecificSettings.JobName = tl.getVariable('System.JobName');
        inputDataContract.TfsSpecificSettings.JobAttempt = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('System.JobAttempt')) ? null : Number(tl.getVariable('System.JobAttempt'));

        return inputDataContract;
}

function getTargetBinariesSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    inputDataContract.TargetBinariesSettings = <idc.TargetBinariesSettings>{};
    inputDataContract.TargetBinariesSettings.BuildConfig = tl.getInput('configuration');
    inputDataContract.TargetBinariesSettings.BuildPlatform = tl.getInput('platform');
    return inputDataContract;
}

function getTestReportingSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    inputDataContract.TestReportingSettings = <idc.TestReportingSettings>{};
    inputDataContract.TestReportingSettings.TestRunTitle = tl.getInput('testRunTitle');
    inputDataContract.TestReportingSettings.TestRunSystem = 'VSTS - vstest';

    const resultsDir = path.resolve(tl.getVariable('Agent.TempDirectory'), tl.getInput('resultsFolder'));
    inputDataContract.TestReportingSettings.TestResultsDirectory =  resultsDir;
    tl.debug("TestResultsFolder: " + resultsDir);
    addResultsDirectoryToTelemetry(resultsDir);
    
    inputDataContract.TestReportingSettings.TestSourceSettings = <idc.TestSourceSettings>{};
    inputDataContract.TestReportingSettings.TestSourceSettings.PullRequestTargetBranchName = tl.getVariable('System.PullRequest.TargetBranch');
    inputDataContract.TestReportingSettings.ExecutionStatusSettings = <idc.ExecutionStatusSettings>{};
    inputDataContract.TestReportingSettings.ExecutionStatusSettings.MinimumExecutedTestsExpected = 0;
    inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet = "donothing";
    inputDataContract.TestReportingSettings.ExecutionStatusSettings.IgnoreTestFailures = utils.Helper.stringToBool(tl.getVariable('vstest.ignoretestfailures'));
    if (utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.TestRunTitle)) {

        let definitionName = tl.getVariable('BUILD_DEFINITIONNAME');
        let buildOrReleaseName = tl.getVariable('BUILD_BUILDNUMBER');

        if (inputDataContract.TfsSpecificSettings.ReleaseUri) {
            definitionName = tl.getVariable('RELEASE_DEFINITIONNAME');
            buildOrReleaseName = tl.getVariable('RELEASE_RELEASENAME');
        }

        inputDataContract.TestReportingSettings.TestRunTitle = `TestRun_${definitionName}_${buildOrReleaseName}`;
    }

    const actionOnThresholdNotMet = tl.getBoolInput('failOnMinTestsNotRun');
    if (actionOnThresholdNotMet)
    {
        inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet = "fail";       
        const minimumExpectedTests = parseInt(tl.getInput('minimumExpectedTests'));
        if (!isNaN(minimumExpectedTests)) {
            inputDataContract.TestReportingSettings.ExecutionStatusSettings.MinimumExecutedTestsExpected = minimumExpectedTests;
        } else {
            throw new Error(tl.loc('invalidMinimumExpectedTests :' + tl.getInput('minimumExpectedTests')));
        }
    }
    
    console.log(tl.loc('actionOnThresholdNotMet', inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet))
    console.log(tl.loc('minimumExpectedTests', inputDataContract.TestReportingSettings.ExecutionStatusSettings.MinimumExecutedTestsExpected));
    return inputDataContract;
}

function getTestPlatformSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    const vsTestLocationMethod = tl.getInput('vstestLocationMethod');
    if (vsTestLocationMethod === utils.Constants.vsTestVersionString) {
        const vsTestVersion = tl.getInput('vsTestVersion');
        if (utils.Helper.isNullEmptyOrUndefined(vsTestVersion)) {
            console.log(tl.loc('VsTestVersionEmpty'));
            throw new Error(tl.loc('VsTestVersionEmpty'));
        } else if (vsTestVersion.toLowerCase() === 'toolsinstaller') {
            tl.debug('Trying VsTest installed by tools installer.');
            ci.publishEvent({ subFeature: 'ToolsInstallerSelected', isToolsInstallerPackageLocationSet: !utils.Helper.isNullEmptyOrUndefined(tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable)) });

            inputDataContract.UsingXCopyTestPlatformPackage = true;

            const vsTestPackageLocation = tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable);
            tl.debug('Path to VsTest from tools installer: ' + vsTestPackageLocation);

            // get path to vstest.console.exe
            const matches = tl.findMatch(vsTestPackageLocation, '**\\vstest.console.exe');
            if (matches && matches.length !== 0) {
                inputDataContract.VsTestConsolePath = path.dirname(matches[0]);
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

        } else if ((vsTestVersion !== '17.0') && (vsTestVersion !== '16.0') && (vsTestVersion !== '15.0') && (vsTestVersion !== '14.0')
            && (vsTestVersion.toLowerCase() !== 'latest')) {
            throw new Error(tl.loc('vstestVersionInvalid', vsTestVersion));
        } else if (vsTestLocationMethod === utils.Constants.vsTestVersionString && vsTestVersion === '12.0') {
            throw (tl.loc('vs2013NotSupportedInDta'));
        } else {
            console.log(tl.loc('vsVersionSelected', vsTestVersion));
            inputDataContract.VsTestConsolePath = getTestPlatformPath(inputDataContract);
        }
    } else {
        // hydra: should it be full path or directory above?
        inputDataContract.VsTestConsolePath = tl.getInput('vsTestLocation');
        console.log(tl.loc('vstestLocationSpecified', 'vstest.console.exe', inputDataContract.VsTestConsolePath));
        if (inputDataContract.VsTestConsolePath.endsWith('vstest.console.exe')) {
            inputDataContract.VsTestConsolePath = path.dirname(inputDataContract.VsTestConsolePath);
        }
    }

    return inputDataContract;
}

function getLoggingSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    // InputDataContract.Logging
    inputDataContract.Logging = <idc.Logging>{};
    inputDataContract.Logging.EnableConsoleLogs = true;
    if (utils.Helper.isDebugEnabled()) {
        inputDataContract.Logging.DebugLogging = true;
    }
    return inputDataContract;
}

function getProxySettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    // Get proxy details
    inputDataContract.ProxySettings = <idc.ProxySettings>{};
    inputDataContract.ProxySettings.ProxyUrl = tl.getVariable('agent.proxyurl');
    inputDataContract.ProxySettings.ProxyUsername = tl.getVariable('agent.proxyusername');
    inputDataContract.ProxySettings.ProxyPassword = tl.getVariable('agent.proxypassword');
    inputDataContract.ProxySettings.ProxyBypassHosts = tl.getVariable('agent.proxybypasslist');
    return inputDataContract;
}

function getDistributionSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    inputDataContract.DistributionSettings = <idc.DistributionSettings>{};
    inputDataContract.DistributionSettings.NumberOfTestAgents = 1;

    const totalJobsInPhase = parseInt(tl.getVariable('SYSTEM_TOTALJOBSINPHASE'));
    if (!isNaN(totalJobsInPhase)) {
        inputDataContract.DistributionSettings.NumberOfTestAgents = totalJobsInPhase;
    }
    console.log(tl.loc('dtaNumberOfAgents', inputDataContract.DistributionSettings.NumberOfTestAgents));

    const distributionType = tl.getInput('distributionBatchType');

    switch (distributionType) {

        case 'basedOnTestCases':
            inputDataContract.DistributionSettings.DistributeTestsBasedOn = DistributionTypes.NUMBEROFTESTMETHODSBASED;
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
            break;

        case 'basedOnExecutionTime':
            inputDataContract.DistributionSettings.DistributeTestsBasedOn = DistributionTypes.EXECUTIONTIMEBASED;
            const batchBasedOnExecutionTimeOption = tl.getInput('batchingBasedOnExecutionTimeOption');

            if (batchBasedOnExecutionTimeOption && batchBasedOnExecutionTimeOption === 'customTimeBatchSize') {
                const batchExecutionTimeInSec = parseInt(tl.getInput('customRunTimePerBatchValue'));
                if (isNaN(batchExecutionTimeInSec) || batchExecutionTimeInSec <= 0) {
                    throw new Error(tl.loc('invalidRunTimePerBatch', batchExecutionTimeInSec));
                }
                inputDataContract.DistributionSettings.RunTimePerSlice = batchExecutionTimeInSec;
                console.log(tl.loc('RunTimePerBatch', inputDataContract.DistributionSettings.RunTimePerSlice));
            }
            break;

        case 'basedOnAssembly':
            inputDataContract.DistributionSettings.DistributeTestsBasedOn = DistributionTypes.ASSEMBLYBASED;
            break;
    }

    return inputDataContract;
}

function getExecutionSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    inputDataContract.ExecutionSettings = <idc.ExecutionSettings>{};

    if (tl.filePathSupplied('runSettingsFile')) {
        inputDataContract.ExecutionSettings.SettingsFile = path.resolve(tl.getPathInput('runSettingsFile'));
        console.log(tl.loc('runSettingsFileInput', inputDataContract.ExecutionSettings.SettingsFile));
    }

    inputDataContract.ExecutionSettings.TempFolder = utils.Helper.GetTempFolder();

    inputDataContract.ExecutionSettings.OverridenParameters = tl.getInput('overrideTestrunParameters');
    tl.debug(`OverrideTestrunParameters set to ${inputDataContract.ExecutionSettings.OverridenParameters}`);

    inputDataContract.ExecutionSettings.AssemblyLevelParallelism = tl.getBoolInput('runInParallel');
    console.log(tl.loc('runInParallelInput', inputDataContract.ExecutionSettings.AssemblyLevelParallelism));

    inputDataContract.ExecutionSettings.RunTestsInIsolation = tl.getBoolInput('runTestsInIsolation');
    console.log(tl.loc('runInIsolationInput', inputDataContract.ExecutionSettings.RunTestsInIsolation));

    if (serverBasedRun && inputDataContract.ExecutionSettings.RunTestsInIsolation) {
        inputDataContract.ExecutionSettings.RunTestsInIsolation = null;
        tl.warning(tl.loc('runTestInIsolationNotSupported'));
    }

    inputDataContract.ExecutionSettings.PathToCustomTestAdapters = tl.getInput('pathtoCustomTestAdapters');

    if (!utils.Helper.isNullOrWhitespace(inputDataContract.ExecutionSettings.PathToCustomTestAdapters)) {
        inputDataContract.ExecutionSettings.PathToCustomTestAdapters = path.resolve(inputDataContract.ExecutionSettings.PathToCustomTestAdapters);
    }

    if (inputDataContract.ExecutionSettings.PathToCustomTestAdapters &&
        !utils.Helper.pathExistsAsDirectory(inputDataContract.ExecutionSettings.PathToCustomTestAdapters)) {
        throw new Error(tl.loc('pathToCustomAdaptersInvalid', inputDataContract.ExecutionSettings.PathToCustomTestAdapters));
    }
    console.log(tl.loc('pathToCustomAdaptersInput', inputDataContract.ExecutionSettings.PathToCustomTestAdapters));

    inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = false;
    if (tl.getVariable('ProceedAfterAbortedTestCase') && tl.getVariable('ProceedAfterAbortedTestCase').toUpperCase() === 'TRUE') {
        inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = true;
    }
    tl.debug('ProceedAfterAbortedTestCase is set to : ' + inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase);

    // hydra: Maybe move all warnings to a diff function
    if (tl.getBoolInput('uiTests') && inputDataContract.ExecutionSettings.AssemblyLevelParallelism) {
        tl.warning(tl.loc('uitestsparallel'));
    }

    inputDataContract.ExecutionSettings.AdditionalConsoleParameters = tl.getInput('otherConsoleOptions');
    console.log(tl.loc('otherConsoleOptionsInput', inputDataContract.ExecutionSettings.AdditionalConsoleParameters));

    if (serverBasedRun && inputDataContract.ExecutionSettings.AdditionalConsoleParameters) {
        tl.warning(tl.loc('otherConsoleOptionsNotSupported'));
        inputDataContract.ExecutionSettings.AdditionalConsoleParameters = null;
    }

    inputDataContract.ExecutionSettings.CodeCoverageEnabled = tl.getBoolInput('codeCoverageEnabled');
    console.log(tl.loc('codeCoverageInput', inputDataContract.ExecutionSettings.CodeCoverageEnabled));

    inputDataContract = getDiagnosticsSettings(inputDataContract);
    console.log(tl.loc('diagnosticsInput', inputDataContract.ExecutionSettings.DiagnosticsSettings.Enabled));    

    // Custom console wrapper settings
    inputDataContract.ExecutionSettings.PathToCustomVsTestConsoleWrapperAssembly = tl.getVariable('vstest.customConsoleWrapperAssemblyLocation');

    inputDataContract = getTiaSettings(inputDataContract);
    inputDataContract = getRerunSettings(inputDataContract);

    return inputDataContract;
}

function getDiagnosticsSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    inputDataContract.ExecutionSettings.DiagnosticsSettings = <idc.DiagnosticsSettings>{};
    if (enableDiagnosticsSettings) {
        inputDataContract.ExecutionSettings.DiagnosticsSettings.Enabled = tl.getBoolInput('diagnosticsEnabled');
        inputDataContract.ExecutionSettings.DiagnosticsSettings.DumpCollectionType = tl.getInput('collectDumpOn').toLowerCase();
    } else {
        inputDataContract.ExecutionSettings.DiagnosticsSettings.Enabled = false;
    }
    return inputDataContract;
}

function getTiaSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    // TIA stuff
    if (tl.getBoolInput('runOnlyImpactedTests') === false) {
        return inputDataContract;
    }

    inputDataContract.ExecutionSettings.TiaSettings = <idc.TiaSettings>{};
    inputDataContract.ExecutionSettings.TiaSettings.Enabled = tl.getBoolInput('runOnlyImpactedTests');
    inputDataContract.ExecutionSettings.TiaSettings.RebaseLimit = +tl.getInput('runAllTestsAfterXBuilds');
    inputDataContract.ExecutionSettings.TiaSettings.FileLevel = getTIALevel(tl.getVariable('tia.filelevel'));
    inputDataContract.ExecutionSettings.TiaSettings.SourcesDirectory = tl.getVariable('build.sourcesdirectory');
    inputDataContract.ExecutionSettings.TiaSettings.FilterPaths = tl.getVariable('TIA_IncludePathFilters');

    // User map file
    inputDataContract.ExecutionSettings.TiaSettings.UserMapFile = tl.getVariable('tia.usermapfile');

    // disable editing settings file to switch on data collector
    inputDataContract.ExecutionSettings.TiaSettings.DisableDataCollection = utils.Helper.stringToBool(tl.getVariable('tia.disabletiadatacollector'));

    // This option gives the user ability to add Fully Qualified name filters for test impact. Does not work with XUnit
    inputDataContract.ExecutionSettings.TiaSettings.UseTestCaseFilterInResponseFile = utils.Helper.stringToBool(tl.getVariable('tia.useTestCaseFilterInResponseFile'));

    // A legacy switch to disable test impact from build variables
    inputDataContract.ExecutionSettings.TiaSettings.Enabled = !utils.Helper.stringToBool(tl.getVariable('DisableTestImpactAnalysis'));

    const buildReason = tl.getVariable('Build.Reason');

    // https://www.visualstudio.com/en-us/docs/build/define/variables
    // PullRequest -> This is the case for TfsGit PR flow
    // CheckInShelveset -> This is the case for TFVC Gated Checkin
    if (buildReason && (buildReason === 'PullRequest' || buildReason === 'CheckInShelveset')) {
        inputDataContract.ExecutionSettings.TiaSettings.IsPrFlow = true;
    } else {
        inputDataContract.ExecutionSettings.TiaSettings.IsPrFlow = utils.Helper.stringToBool(tl.getVariable('tia.isPrFlow'));
    }

    return inputDataContract;
}

function getRerunSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {

    if (tl.getBoolInput('rerunFailedTests') === false) {
        return inputDataContract;
    }

    inputDataContract.ExecutionSettings.RerunSettings = <idc.RerunSettings>{};
    inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests = tl.getBoolInput('rerunFailedTests');
    console.log(tl.loc('rerunFailedTests', inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests));
    const rerunType = tl.getInput('rerunType') || 'basedOnTestFailurePercentage';
    inputDataContract.ExecutionSettings.RerunSettings.RerunType = rerunType;

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

    return inputDataContract;
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

function getTestPlatformPath(inputDataContract : idc.InputDataContract) {
    const vsTestVersion = tl.getInput('vsTestVersion');

    if (vsTestVersion.toLowerCase() === 'latest') {
        tl.debug('Searching for latest Visual Studio.');
        let vstestconsolePath = getVSTestConsolePath('17.0', '18.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }
         vstestconsolePath = getVSTestConsolePath('16.0', '17.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }

        vstestconsolePath = getVSTestConsolePath('15.0', '16.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'TestWindow');
        }

        // fallback
        tl.debug('Unable to find an instance of Visual Studio 2017 or higher.');
        tl.debug('Searching for Visual Studio 2015..');
        return getVSTestLocation(14);
    }

    const vsVersion: number = parseFloat(vsTestVersion);

    if (vsVersion === 17.0) {
        const vstestconsolePath = getVSTestConsolePath('17.0', '18.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    if (vsVersion === 16.0) {
        const vstestconsolePath = getVSTestConsolePath('16.0', '17.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    if (vsVersion === 15.0) {
        const vstestconsolePath = getVSTestConsolePath('15.0', '16.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'TestWindow');
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    tl.debug('Searching for Visual Studio ' + vsVersion.toString());
    return getVSTestLocation(vsVersion);
}

function getVSTestConsolePath(versionLowerLimit : string, versionUpperLimit : string): string {
    let vswhereTool = tl.tool(path.join(__dirname, 'vswhere.exe'));

    console.log(tl.loc('LookingForVsInstalltion', `[${versionLowerLimit},${versionUpperLimit})`));
    vswhereTool.line(`-version [${versionLowerLimit},${versionUpperLimit}) -latest -products * -requires Microsoft.VisualStudio.PackageGroup.TestTools.Core -property installationPath`);
    let vsPath = vswhereTool.execSync({ silent: true } as tr.IExecSyncOptions).stdout;
    vsPath = utils.Helper.trimString(vsPath);

    if (!utils.Helper.isNullOrWhitespace(vsPath)) {
        tl.debug('Visual Studio 15.0 or higher installed path: ' + vsPath);
        return vsPath;
    }

    // Look for build tool installation if full VS not present
    console.log(tl.loc('LookingForBuildToolsInstalltion', `[${versionLowerLimit},${versionUpperLimit})`));
    vswhereTool = tl.tool(path.join(__dirname, 'vswhere.exe'));
    vswhereTool.line(`-version [${versionLowerLimit},${versionUpperLimit}) -latest -products * -requires Microsoft.VisualStudio.Component.TestTools.BuildTools -property installationPath`);
    vsPath = vswhereTool.execSync({ silent: true } as tr.IExecSyncOptions).stdout;
    vsPath = utils.Helper.trimString(vsPath);
    if (!utils.Helper.isNullOrWhitespace(vsPath)) {
        tl.debug('Build tools installed path: ' + vsPath);
        return vsPath;
    }

    return null;
}

export function getVSTestLocation(vsVersion: number): string {
    const vsCommon: string = tl.getVariable('VS' + vsVersion + '0COMNTools');
    if (!vsCommon) {
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }
    return path.join(vsCommon, '..\\IDE\\CommonExtensions\\Microsoft\\TestWindow');
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

function addResultsDirectoryToTelemetry(resultsDir: string){

    if (resultsDir.startsWith(path.join(tl.getVariable('Agent.TempDirectory'), 'TestResults'))) {  
        ci.publishTelemetry('TestExecution', 'ResultsDirectory', { 'TestResultsFolderUi': '$(Agent.TempDirectory)/TestResults' } );
    }
    else if (resultsDir.startsWith(tl.getVariable('Agent.TempDirectory'))) {
        ci.publishTelemetry('TestExecution', 'ResultsDirectory', { 'TestResultsFolderUi': '$(Agent.TempDirectory)' } );
    }
    else if (resultsDir.startsWith(tl.getVariable('Common.TestResultsDirectory'))) {
        ci.publishTelemetry('TestExecution', 'ResultsDirectory', { 'TestResultsFolderUi': '$(Common.TestResultsDirectory)' })
    }
    else if (resultsDir.startsWith(tl.getVariable('System.DefaultWorkingDirectory'))) {
        ci.publishTelemetry('TestExecution', 'ResultsDirectory', { 'TestResultsFolderUi': '$(System.DefaultWorkingDirectory)' })
    }
    else {
        ci.publishTelemetry('TestExecution', 'ResultsDirectory', { 'TestResultsFolderUi': 'Custom Directory' })
    }
}

export function setIsServerBasedRun(isServerBasedRun: boolean) {
    serverBasedRun = isServerBasedRun;
}

export function setEnableDiagnosticsSettings(enableDiagnosticsSettingsFF: boolean) {
    enableDiagnosticsSettings = enableDiagnosticsSettingsFF;
    tl.debug('Diagnostics feature flag is set to: ' + enableDiagnosticsSettingsFF);
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
