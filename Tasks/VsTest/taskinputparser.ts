import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import path = require('path');
import Q = require('q');
import models = require('./models')

let os = require('os');
let uuid = require('node-uuid');

export function getDistributedTestConfigurations(): models.DtaTestConfigurations {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const dtaConfiguration = {} as models.DtaTestConfigurations;
    initTestConfigurations(dtaConfiguration);
    dtaConfiguration.onDemandTestRunId = tl.getInput('tcmTestRun');
    return dtaConfiguration;
}

export function getvsTestConfigurations(): models.VsTestConfigurations {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const vsTestConfiguration = {} as models.VsTestConfigurations;
    initTestConfigurations(vsTestConfiguration);
    vsTestConfiguration.publishRunAttachments = tl.getInput('publishRunAttachments');
    vsTestConfiguration.runInParallel = tl.getBoolInput('runInParallel');
    vsTestConfiguration.vstestDiagFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    vsTestConfiguration.ignoreVstestFailure = tl.getVariable('vstest.ignoretestfailures');
    vsTestConfiguration.tiaConfig = getTiaConfiguration();

    // only to facilitate the writing of unit tests 
    vsTestConfiguration.vs15HelperPath = tl.getVariable('vs15Helper');
    if (!vsTestConfiguration.vs15HelperPath) {
        vsTestConfiguration.vs15HelperPath = path.join(__dirname, 'vs15Helper.ps1');
    }
    return vsTestConfiguration;
}

function initTestConfigurations(testConfiguration: models.TestConfigurations)
{
    testConfiguration.pathtoCustomTestAdapters = tl.getInput('pathtoCustomTestAdapters');
    testConfiguration.sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
    testConfiguration.testDropLocation = tl.getInput('searchFolder');  
    testConfiguration.testcaseFilter = tl.getInput('testFiltercriteria');
    testConfiguration.runSettingsFile = tl.getPathInput('runSettingsFile');
    testConfiguration.overrideTestrunParameters = tl.getInput('overrideTestrunParameters');
    testConfiguration.buildConfig = tl.getInput('configuration');
    testConfiguration.buildPlatform = tl.getInput('platform');
    testConfiguration.testRunTitle = tl.getInput('testRunTitle');
    testConfiguration.vsTestVersion = tl.getInput('testPlatform');
    initDataCollectorConfigurations(testConfiguration);
}

function initDataCollectorConfigurations(testConfiguration: models.TestConfigurations)
{
    const dataCollectors: string[] = tl.getDelimitedInput('collectDiagnosticData', ',', true);
    testConfiguration.codeCoverageEnabled = false;
    testConfiguration.videoCoverageEnabled = false;
    dataCollectors.forEach((collector) => {
        switch(collector.toLowerCase()) {
            case 'codecoverage':
                testConfiguration.codeCoverageEnabled = true;
                break;
            case 'video':
                testConfiguration.videoCoverageEnabled = true;
                break;
        }
    });
}

function getTiaConfiguration() : models.TiaConfiguration
{
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