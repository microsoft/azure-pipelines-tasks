import models = require('./models');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import path = require('path');

let perf = require('performance-now');

export class TestSelectorInvoker {
    public publishCodeChanges(tiaConfig: models.TiaConfiguration, testCaseFilterFile: string, taskInstanceIdentifier: string): number {
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
                'userMapFile': tiaConfig.userMapFile ? tiaConfig.userMapFile : "",
                'testCaseFilterResponseFile': testCaseFilterFile ? testCaseFilterFile : "",
                'AGENT_VERSION': tl.getVariable('AGENT.VERSION'),
                'VsTest_TaskInstanceIdentifier': taskInstanceIdentifier
            },
            silent: null,
            failOnStdErr: null,
            ignoreReturnCode: null,
            outStream: null,
            errStream: null,
            windowsVerbatimArguments: null
        })

        endTime = perf();
        elapsedTime = endTime - startTime;
        tl.debug(tl.loc('PublishCodeChangesPerfTime', elapsedTime));

        if (output.code !== 0) {
            tl.warning(output.stderr);
        }

        tl.debug('completed publish code changes');
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
}