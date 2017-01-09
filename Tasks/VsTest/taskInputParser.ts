import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import path = require('path');
import Q = require('q');
import distributedTest = require('./distributedTest')
import models = require('./models')

var os = require('os');
var uuid = require('node-uuid');

export function getDistributedTestConfigurations(): models.dtaTestConfigurations {
    var dtaConfiguration = {} as models.dtaTestConfigurations;
    getTestConfigurations(dtaConfiguration);
    return dtaConfiguration;
}

export function getvsTestConfigurations(): models.vsTestConfigurations {
    var vsTestConfiguration = {} as models.vsTestConfigurations;
    getTestConfigurations(vsTestConfiguration);
    vsTestConfiguration.vsTestVersion = tl.getInput('vsTestVersion');
    vsTestConfiguration.vstestLocationMethod = tl.getInput('vstestLocationMethod');
    vsTestConfiguration.vstestLocation = tl.getPathInput('vsTestLocation');
    vsTestConfiguration.pathtoCustomTestAdapters = tl.getInput('pathtoCustomTestAdapters');   
    vsTestConfiguration.otherConsoleOptions = tl.getInput('otherConsoleOptions');
    vsTestConfiguration.publishRunAttachments = tl.getInput('publishRunAttachments');
    vsTestConfiguration.runInParallel = tl.getBoolInput('runInParallel');
    vsTestConfiguration.vstestDiagFile = path.join(os.tmpdir(), uuid.v1() + ".txt");
    vsTestConfiguration.ignoreVstestFailure = tl.getVariable("vstest.ignoretestfailures");
    vsTestConfiguration.tiaConfig = getTiaConfiguration();

    // only to facilitate the writing of unit tests 
    vsTestConfiguration.vs15HelperPath = tl.getVariable('vs15Helper');
    if (!vsTestConfiguration.vs15HelperPath) {
        vsTestConfiguration.vs15HelperPath = path.join(__dirname, 'vs15Helper.ps1');
    }
    return vsTestConfiguration;
}

function getTestConfigurations(testConfiguration: models.testConfigurations)
{    
    testConfiguration.sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
    testConfiguration.testcaseFilter = tl.getInput('testFiltercriteria');
    testConfiguration.runSettingsFile = tl.getPathInput('runSettingsFile');
    testConfiguration.testDropLocation = tl.getInput('searchFolder');
    testConfiguration.overrideTestrunParameters = tl.getInput('overrideTestrunParameters');
    testConfiguration.codeCoverageEnabled = tl.getBoolInput('codeCoverageEnabled');
    testConfiguration.buildConfig = tl.getInput('configuration');
    testConfiguration.buildPlatform = tl.getInput('platform');    
    testConfiguration.testRunTitle = tl.getInput('testRunTitle');
}

function getTiaConfiguration() : models.tiaConfiguration
{
    var tiaConfiguration = {} as models.tiaConfiguration;
    tiaConfiguration.tiaEnabled =  tl.getBoolInput('runOnlyImpactedTests');
    tiaConfiguration.tiaRebaseLimit = tl.getInput('runAllTestsAfterXBuilds');
    tiaConfiguration.fileLevel = tl.getVariable('tia.filelevel');
    tiaConfiguration.sourcesDir = tl.getVariable('build.sourcesdirectory');
    tiaConfiguration.runIdFile = path.join(os.tmpdir(), uuid.v1() + ".txt");
    tiaConfiguration.baseLineBuildIdFile = path.join(os.tmpdir(), uuid.v1() + ".txt");
    tiaConfiguration.useNewCollector = false;
    var useNewCollector = tl.getVariable('tia.useNewCollector');
    if ( useNewCollector && useNewCollector.toUpperCase() === "TRUE") {
        tiaConfiguration.useNewCollector = true;
    }
    tiaConfiguration.isPrFlow = tl.getVariable('tia.isPrFlow');

    var releaseuri = tl.getVariable("release.releaseUri")
    tiaConfiguration.context = "CI";
    if (releaseuri) {
        tiaConfiguration.context = "CD";
    }
    return tiaConfiguration;
}