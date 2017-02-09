import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import models = require('./models');
import utils = require('./helpers');

let os = require('os');
let uuid = require('node-uuid');

export function getDistributedTestConfigurations(): models.DtaTestConfigurations {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const dtaConfiguration = {} as models.DtaTestConfigurations;
    initTestConfigurations(dtaConfiguration);
    if(dtaConfiguration.tiaConfig.tiaEnabled) {
        tl.warning(tl.loc('tiaNotSupportedInDta'));
        dtaConfiguration.tiaConfig.tiaEnabled = false;
    }
    if(dtaConfiguration.runTestsInIsolation) {
        tl.warning(tl.loc('runTestInIsolationNotSupported'));
    }

    dtaConfiguration.numberOfAgentsInPhase = 0;
    const totalJobsInPhase = parseInt(tl.getVariable('SYSTEM_TOTALJOBSINPHASE'));
    if(!isNaN(totalJobsInPhase)) {
        dtaConfiguration.numberOfAgentsInPhase = totalJobsInPhase;
    }

    dtaConfiguration.onDemandTestRunId = tl.getInput('tcmTestRun');

    dtaConfiguration.dtaEnvironment = initDtaEnvironment();

    return dtaConfiguration;
}

export function getvsTestConfigurations(): models.VsTestConfigurations {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const vsTestConfiguration = {} as models.VsTestConfigurations;
    initTestConfigurations(vsTestConfiguration);
    vsTestConfiguration.publishRunAttachments = tl.getInput('publishRunAttachments');    
    vsTestConfiguration.vstestDiagFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    vsTestConfiguration.ignoreVstestFailure = tl.getVariable('vstest.ignoretestfailures');
    return vsTestConfiguration;
}

function initDtaEnvironment(): models.DtaEnvironment {
    const dtaEnvironment = {} as models.DtaEnvironment;
    dtaEnvironment.tfsCollectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
    dtaEnvironment.patToken = tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken'];

    //TODO : Consider build scenario
    const releaseId = tl.getVariable('Release.ReleaseId');
    const phaseId = tl.getVariable('Release.DeployPhaseId');
    const projectName = tl.getVariable('System.TeamProject');
    const taskInstanceId = getDtaInstanceId();
    
    if(releaseId) {
        dtaEnvironment.environmentUri = 'dta://env/' + projectName + '/_apis/release/' + releaseId + '/' + phaseId + '/' + taskInstanceId;        
    } else {
        const buildId = tl.getVariable('Build.BuildId');
        dtaEnvironment.environmentUri = 'dta://env/' + projectName + '/_apis/build/' + buildId + '/' + taskInstanceId;
    }

    dtaEnvironment.dtaHostLogFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'DTAExecutionHost.exe.log');
    return dtaEnvironment;
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
    testConfiguration.pathtoCustomTestAdapters = tl.getInput('pathtoCustomTestAdapters');
    testConfiguration.sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
    testConfiguration.testDropLocation = tl.getInput('searchFolder');  
    testConfiguration.testcaseFilter = tl.getInput('testFiltercriteria');
    testConfiguration.settingsFile = tl.getPathInput('runSettingsFile');
    testConfiguration.overrideTestrunParameters = tl.getInput('overrideTestrunParameters');
    testConfiguration.buildConfig = tl.getInput('configuration');
    testConfiguration.buildPlatform = tl.getInput('platform');
    testConfiguration.testRunTitle = tl.getInput('testRunTitle');
    testConfiguration.runInParallel = tl.getBoolInput('runTestsInParallel');
    testConfiguration.runTestsInIsolation = tl.getBoolInput('runTestsInIsolation');
    testConfiguration.tiaConfig = getTiaConfiguration();
    testConfiguration.testSelection = tl.getInput('testSelector');

    if(testConfiguration.testSelection.toLowerCase() === 'testplan') {    
        testConfiguration.testplan = parseInt(tl.getInput('testPlan'));
        testConfiguration.testPlanConfigId = parseInt(tl.getInput('testConfiguration'));
        
        var testSuiteStrings = tl.getDelimitedInput('testSuite', ',', true);
        testConfiguration.testSuites = new Array<number>();
        testSuiteStrings.forEach(element => {        
        testConfiguration.testSuites.push(parseInt(element));
        });
    }

    testConfiguration.vsTestVersion = tl.getInput('vsTestVersion');    
    if(utils.Helper.isNullEmptyOrUndefined(testConfiguration.vsTestVersion)) {
        tl._writeLine('vsTestVersion is null or empty');
        throw new Error("vsTestVersion is null or empty");
    }
        // only to facilitate the writing of unit tests 
    testConfiguration.vs15HelperPath = tl.getVariable('vs15Helper');
    if (!testConfiguration.vs15HelperPath) {
        testConfiguration.vs15HelperPath = path.join(__dirname, 'vs15Helper.ps1');
    }

    testConfiguration.codeCoverageEnabled = tl.getBoolInput('codeCoverage');
}

function getTiaConfiguration() : models.TiaConfiguration {
    const tiaConfiguration = {} as models.TiaConfiguration;
    tiaConfiguration.tiaEnabled =  tl.getBoolInput('runOnlyImpactedTests');
    tiaConfiguration.tiaRebaseLimit = tl.getInput('runAllTestsAfterXBuilds');
    tiaConfiguration.fileLevel = tl.getVariable('tia.filelevel');
    tiaConfiguration.sourcesDir = tl.getVariable('build.sourcesdirectory');
    tiaConfiguration.tiaFilterPaths = tl.getVariable("TIA_IncludePathFilters");
    tiaConfiguration.runIdFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    tiaConfiguration.baseLineBuildIdFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    tiaConfiguration.useNewCollector = false;
    const useNewCollector = tl.getVariable('tia.useNewCollector');
    if ( useNewCollector && useNewCollector.toUpperCase() === 'TRUE') {
        tiaConfiguration.useNewCollector = true;
    }
    tiaConfiguration.isPrFlow = tl.getVariable('tia.isPrFlow');

    const releaseuri = tl.getVariable('release.releaseUri')
    tiaConfiguration.context = 'CI';
    if (releaseuri) {
        tiaConfiguration.context = 'CD';
    }
    return tiaConfiguration;
}