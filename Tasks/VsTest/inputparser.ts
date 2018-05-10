import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as utils from './helpers';
import * as constants from './constants';
import * as os from 'os';
import * as ci from './cieventlogger';
import { AreaCodes, ResultMessages, DistributionTypes } from './constants';
import * as idc from './inputdatacontract';
import * as taskinputparser from './taskinputparser';
import * as versionfinder from './versionfinder';
const uuid = require('uuid');
const regedit = require('regedit');

export function getDistributedTestConfigurations() : idc.InputDataContract {
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

    taskinputparser.logWarningForWER(tl.getBoolInput('uiTests'));

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

    inputDataContract.TeamProject = tl.getVariable('System.TeamProject');
    inputDataContract.CollectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    inputDataContract.AccessToken = tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken'];
    inputDataContract.AgentName = tl.getVariable('Agent.MachineName') + '-' + tl.getVariable('Agent.Name') + '-' + tl.getVariable('Agent.Id');
    inputDataContract.RunIdentifier = getRunIdentifier();

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
    console.log(tl.loc('searchFolderInput', inputDataContract.TestSelectionSettings.SearchFolder));

    return inputDataContract;
}

function getTfsSpecificSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
        inputDataContract.TfsSpecificSettings = <idc.TfsSpecificSettings>{};
        inputDataContract.TfsSpecificSettings.BuildId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Build.Buildid')) ? null : Number(tl.getVariable('Build.Buildid'));
        inputDataContract.TfsSpecificSettings.BuildUri = tl.getVariable('Build.BuildUri');
        inputDataContract.TfsSpecificSettings.ReleaseId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Release.ReleaseId')) ? null : Number(tl.getVariable('Release.ReleaseId'));
        inputDataContract.TfsSpecificSettings.ReleaseUri = tl.getVariable('Release.ReleaseUri');
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

    if (utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.TestRunTitle)) {

        let definitionName = tl.getVariable('BUILD_DEFINITIONNAME');
        let buildOrReleaseName = tl.getVariable('BUILD_BUILDNUMBER');

        if (inputDataContract.TfsSpecificSettings.ReleaseUri) {
            definitionName = tl.getVariable('RELEASE_DEFINITIONNAME');
            buildOrReleaseName = tl.getVariable('RELEASE_RELEASENAME');
        }

        inputDataContract.TestReportingSettings.TestRunTitle = `TestRun_${definitionName}_${buildOrReleaseName}`;
    }

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

        } else if ((vsTestVersion !== '15.0') && (vsTestVersion !== '14.0')
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

    if (distributionType && distributionType === 'basedOnTestCases') {
        inputDataContract.DistributionSettings.DistributeTestsBasedOn = DistributionTypes.NUMBEROFTESTMETHODSBASED;
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
        inputDataContract.DistributionSettings.DistributeTestsBasedOn = DistributionTypes.EXECUTIONTIMEBASED;
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
        inputDataContract.DistributionSettings.DistributeTestsBasedOn = DistributionTypes.ASSEMBLYBASED;
    }
    return inputDataContract;
}

function getExecutionSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    inputDataContract.ExecutionSettings = <idc.ExecutionSettings>{};

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

    // hydra: do we want to shoot this warning?
    if (tl.getBoolInput('runTestsInIsolation')) {
        tl.warning(tl.loc('runTestInIsolationNotSupported'));
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

    inputDataContract.ExecutionSettings.IgnoreTestFailures = utils.Helper.stringToBool(tl.getVariable('vstest.ignoretestfailures'));

    inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = false;
    if (tl.getVariable('ProceedAfterAbortedTestCase') && tl.getVariable('ProceedAfterAbortedTestCase').toUpperCase() === 'TRUE') {
        inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = true;
    }
    tl.debug('ProceedAfterAbortedTestCase is set to : ' + inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase);

    // hydra: Maybe move all warnings to a diff function
    if (tl.getBoolInput('uiTests') && inputDataContract.ExecutionSettings.AssemblyLevelParallelism) {
        tl.warning(tl.loc('uitestsparallel'));
    }

    if (tl.getInput('otherConsoleOptions')) {
        tl.warning(tl.loc('otherConsoleOptionsNotSupported'));
    }

    inputDataContract.ExecutionSettings.CodeCoverageEnabled = tl.getBoolInput('codeCoverageEnabled');
    console.log(tl.loc('codeCoverageInput', inputDataContract.ExecutionSettings.CodeCoverageEnabled));

    inputDataContract = getTiaSettings(inputDataContract);
    inputDataContract = getRerunSettings(inputDataContract);

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
    inputDataContract.TiaBaseLineBuildIdFile = path.join(os.tmpdir(), uuid.v1() + '.txt');

    // User map file
    inputDataContract.ExecutionSettings.TiaSettings.UserMapFile = tl.getVariable('tia.usermapfile');

    // disable editing settings file to switch on data collector
    if (tl.getVariable('tia.disabletiadatacollector') && tl.getVariable('tia.disabletiadatacollector').toUpperCase() === 'TRUE') {
        inputDataContract.ExecutionSettings.TiaSettings.DisableDataCollection = true;
    } else {
        inputDataContract.ExecutionSettings.TiaSettings.DisableDataCollection = false;
    }
    return inputDataContract;
}

function getRerunSettings(inputDataContract : idc.InputDataContract) : idc.InputDataContract {
    // Rerun settings
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
    const taskInstanceId = taskinputparser.getDtaInstanceId();
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
    let vsTestVersion = tl.getInput('vsTestVersion');
    if (vsTestVersion.toLowerCase() === 'latest') {
        // latest
        tl.debug('Searching for latest Visual Studio');
        const vstestconsole15Path = versionfinder.getVSTestConsole15Path();
        if (vstestconsole15Path) {
            vsTestVersion = '15.0';
            return vstestconsole15Path;
        }

        // fallback
        tl.debug('Unable to find an instance of Visual Studio 2017..');
        tl.debug('Searching for Visual Studio 2015..');
        vsTestVersion = '14.0';
        return versionfinder.getVSTestLocation(14);
    }

    const vsVersion: number = parseFloat(vsTestVersion);

    if (vsVersion === 15.0) {
        const vstestconsole15Path = versionfinder.getVSTestConsole15Path();
        if (vstestconsole15Path) {
            return vstestconsole15Path;
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    tl.debug('Searching for Visual Studio ' + vsVersion.toString());
    return versionfinder.getVSTestLocation(vsVersion);
}