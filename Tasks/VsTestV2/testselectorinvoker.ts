import models = require('./models');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import path = require('path');
import { Helper } from './helpers';
const uuid = require('uuid');
let perf = require('performance-now');

export class TestSelectorInvoker {
    public publishCodeChanges(tiaConfig: models.TiaConfiguration, proxyConfig: models.ProxyConfiguration, testCaseFilterFile: string, taskInstanceIdentifier: string): number {
        tl.debug('Entered publish code changes');

        const startTime = perf();
        let endTime: number;
        let elapsedTime: number;
        let pathFilters: string;
        let definitionRunId: string;
        let definitionId: string;
        let prFlow: string;
        let rebaseLimit: string;
        let sourcesDirectory: string;

        let newprovider = 'true';
        if (this.getTIALevel(tiaConfig) === 'method') {
            newprovider = 'false';
        }

        const selectortool = tl.tool(this.getTestSelectorLocation());
        selectortool.arg('PublishCodeChanges');

        if (tiaConfig.context === 'CD') {
            // Release context. Passing Release Id.
            definitionRunId = tl.getVariable('Release.ReleaseId');
            definitionId = tl.getVariable('release.DefinitionId');
        } else {
            // Build context. Passing build id.
            definitionRunId = tl.getVariable('Build.BuildId');
            definitionId = tl.getVariable('System.DefinitionId');
        }

        if (tiaConfig.isPrFlow && tiaConfig.isPrFlow.toUpperCase() === 'TRUE') {
            prFlow = 'true';
        } else {
            prFlow = 'false';
        }

        if (tiaConfig.tiaRebaseLimit) {
            rebaseLimit = tiaConfig.tiaRebaseLimit;
        }

        if (typeof tiaConfig.tiaFilterPaths !== 'undefined') {
            pathFilters = tiaConfig.tiaFilterPaths.trim();
        } else {
            pathFilters = '';
        }

        if (typeof tiaConfig.sourcesDir !== 'undefined') {
            sourcesDirectory = tiaConfig.sourcesDir.trim();
        } else {
            sourcesDirectory = '';
        }

        let output = selectortool.execSync({
            cwd: null,
            env: {
                'collectionurl': tl.getVariable('System.TeamFoundationCollectionUri'),
                'projectid': tl.getVariable('System.TeamProject'),
                'definitionrunid': definitionRunId,
                'definitionid': definitionId,
                'token': tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
                'sourcesdir': sourcesDirectory,
                'newprovider': newprovider,
                'prflow': prFlow,
                'rebaselimit': rebaseLimit,
                'baselinefile': tiaConfig.baseLineBuildIdFile,
                'context': tiaConfig.context,
                'filter': pathFilters,
                'userMapFile': tiaConfig.userMapFile ? tiaConfig.userMapFile : '',
                'testCaseFilterResponseFile': testCaseFilterFile ? testCaseFilterFile : '',
                'proxyurl': proxyConfig.proxyUrl,
                'proxyusername': proxyConfig.proxyUserName,
                'proxypassword': proxyConfig.proxyPassword,
                'proxybypasslist': proxyConfig.proxyBypassHosts,
                'AGENT_VERSION': tl.getVariable('AGENT.VERSION'),
                'VsTest_TaskInstanceIdentifier': taskInstanceIdentifier,
                'VSTS_HTTP_RETRY': tl.getVariable('VSTS_HTTP_RETRY'),
                'VSTS_HTTP_TIMEOUT': tl.getVariable('VSTS_HTTP_TIMEOUT'),
                'DebugLogging': this.isDebugEnabled()
            },
            silent: null,
            outStream: null,
            errStream: null,
            windowsVerbatimArguments: null
        });

        endTime = perf();
        elapsedTime = endTime - startTime;
        console.log('##vso[task.logissue type=warning;SubTaskName=PublishCodeChanges;SubTaskDuration=' + elapsedTime + ']');
        tl.debug(tl.loc('PublishCodeChangesPerfTime', elapsedTime));

        if (output.code !== 0) {
            tl.warning(output.stderr);
        }

        tl.debug('completed publish code changes');
        return output.code;
    }

    public generateResponseFile(tiaConfig: models.TiaConfiguration, vstestConfig: models.VsTestConfigurations, discoveredTests: string, testCaseFilterOutputFile: string): number {
        const startTime = perf();
        let endTime: number;
        let elapsedTime: number;
        let definitionRunId: string;
        let title: string;
        let platformInput: string;
        let configurationInput: string;
        let useTestCaseFilterInResponseFile: string;
        tl.debug('Response file will be generated at ' + tiaConfig.responseFile);
        tl.debug('RunId file will be generated at ' + tiaConfig.runIdFile);

        const selectortool = tl.tool(this.getTestSelectorLocation());
        selectortool.arg('GetImpactedtests');

        if (tiaConfig.context === 'CD') {
            // Release context. Passing Release Id.
            definitionRunId = tl.getVariable('Release.ReleaseId');
        } else {
            // Build context. Passing build id.
            definitionRunId = tl.getVariable('Build.BuildId');
        }

        if (vstestConfig.buildPlatform) {
            platformInput = vstestConfig.buildPlatform;
        } else {
            platformInput = '';
        }

        if (vstestConfig.testRunTitle) {
            title = vstestConfig.testRunTitle;
        } else {
            title = '';
        }

        if (vstestConfig.buildConfig) {
            configurationInput = vstestConfig.buildConfig;
        } else {
            configurationInput = '';
        }

        if (tiaConfig.useTestCaseFilterInResponseFile && tiaConfig.useTestCaseFilterInResponseFile.toUpperCase() === 'TRUE') {
            useTestCaseFilterInResponseFile = 'true';
        } else {
            useTestCaseFilterInResponseFile = 'false';
        }

        let output = selectortool.execSync({
            cwd: null,
            env: {
                'collectionurl': tl.getVariable('System.TeamFoundationCollectionUri'),
                'projectid': tl.getVariable('System.TeamProject'),
                'definitionrunid': definitionRunId,
                'releaseuri': tl.getVariable('release.releaseUri'),
                'releaseenvuri': tl.getVariable('release.environmentUri'),
                'token': tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
                'responsefilepath': tiaConfig.responseFile,
                'discoveredtestspath': discoveredTests,
                'runidfilepath': tiaConfig.runIdFile,
                'testruntitle': title,
                'baselinebuildfilepath': tiaConfig.baseLineBuildIdFile,
                'context': tiaConfig.context,
                'platform': platformInput,
                'configuration': configurationInput,
                'useTestCaseFilterInResponseFile': useTestCaseFilterInResponseFile,
                'testCaseFilterOutputFile': testCaseFilterOutputFile ? testCaseFilterOutputFile : "",
                'isCustomEngineEnabled': String(!Helper.isNullOrWhitespace(tiaConfig.userMapFile)),
                'proxyurl': vstestConfig.proxyConfiguration.proxyUrl,
                'proxyusername': vstestConfig.proxyConfiguration.proxyUserName,
                'proxypassword': vstestConfig.proxyConfiguration.proxyPassword,
                'proxybypasslist': vstestConfig.proxyConfiguration.proxyBypassHosts,
                'AGENT_VERSION': tl.getVariable('AGENT.VERSION'),
                'VsTest_TaskInstanceIdentifier': vstestConfig.taskInstanceIdentifier,
                'VSTS_HTTP_RETRY': tl.getVariable('VSTS_HTTP_RETRY'),
                'VSTS_HTTP_TIMEOUT': tl.getVariable('VSTS_HTTP_TIMEOUT'),
                'DebugLogging': this.isDebugEnabled()
            },
            silent: null,
            outStream: null,
            errStream: null,
            windowsVerbatimArguments: null
        });

        endTime = perf();
        elapsedTime = endTime - startTime;
        console.log('##vso[task.logissue type=warning;SubTaskName=GetImpactedTests;SubTaskDuration=' + elapsedTime + ']');
        tl.debug(tl.loc('GenerateResponseFilePerfTime', elapsedTime));

        if (output.code !== 0) {
            tl.error(output.stderr);
        }

        tl.debug('completed publish code changes');
        return output.code;
    }

    public uploadTestResults(tiaConfig: models.TiaConfiguration, vstestConfig: models.VsTestConfigurations, testResultsDirectory: string): number {
        const startTime = perf();
        let endTime;
        let elapsedTime;
        let definitionRunId: string;
        let resultFile: string;
        let resultFiles;
        if (!Helper.isNullOrWhitespace(testResultsDirectory)) {
            resultFiles = tl.findMatch(testResultsDirectory, path.join(testResultsDirectory, '*.trx'));
        }

        const selectortool = tl.tool(this.getTestSelectorLocation());
        selectortool.arg('UpdateTestResults');

        if (tiaConfig.context === 'CD') {
            definitionRunId = tl.getVariable('Release.ReleaseId');
        } else {
            definitionRunId = tl.getVariable('Build.BuildId');
        }

        if (resultFiles && resultFiles[0]) {
            resultFile = resultFiles[0];
        }

        let output = selectortool.execSync({
            cwd: null,
            env: {
                'collectionurl': tl.getVariable('System.TeamFoundationCollectionUri'),
                'projectid': tl.getVariable('System.TeamProject'),
                'definitionrunid': definitionRunId,
                'token': tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
                'resultfile': resultFile,
                'runidfile': tiaConfig.runIdFile,
                'context': tiaConfig.context,
                'proxyurl': vstestConfig.proxyConfiguration.proxyUrl,
                'proxyusername': vstestConfig.proxyConfiguration.proxyUserName,
                'proxypassword': vstestConfig.proxyConfiguration.proxyPassword,
                'proxybypasslist': vstestConfig.proxyConfiguration.proxyBypassHosts,
                'AGENT_VERSION': tl.getVariable('AGENT.VERSION'),
                'VsTest_TaskInstanceIdentifier': vstestConfig.taskInstanceIdentifier,
                'VSTS_HTTP_RETRY': tl.getVariable('VSTS_HTTP_RETRY'),
                'VSTS_HTTP_TIMEOUT': tl.getVariable('VSTS_HTTP_TIMEOUT'),
                'DebugLogging': this.isDebugEnabled()
            },
            silent: null,
            outStream: null,
            errStream: null,
            windowsVerbatimArguments: null
        });

        endTime = perf();
        elapsedTime = endTime - startTime;
        console.log('##vso[task.logissue type=warning;SubTaskName=UploadTestResults;SubTaskDuration=' + elapsedTime + ']');
        tl.debug(tl.loc('UploadTestResultsPerfTime', elapsedTime));

        if (output.code !== 0) {
            tl.error(output.stderr);
        }

        tl.debug('Completed updating test results');
        return output.code;
    }

    private getTIALevel(tiaConfig: models.TiaConfiguration) {
        if (tiaConfig.fileLevel && tiaConfig.fileLevel.toUpperCase() === 'FALSE') {
            return 'method';
        }
        return 'file';
    }

    private getTestSelectorLocation(): string {
        return path.join(__dirname, 'TestSelector/TestSelector.exe');
    }

    private isDebugEnabled(): string {
        const sysDebug = tl.getVariable('System.Debug');
        if (sysDebug === undefined) {
            return "false";
        }

        return sysDebug.toLowerCase() === 'true' ? "true" : "false";
    }
}