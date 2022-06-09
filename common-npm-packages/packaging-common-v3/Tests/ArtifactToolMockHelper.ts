import tmrm = require('azure-pipelines-task-lib/mock-run');

export function registerArtifactToolUtilitiesMock(tmr: tmrm.TaskMockRunner, toolPath: string) {
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/universal/ArtifactToolUtilities', {
        getArtifactToolFromService: function(serviceUri, accessToken, toolName) {
            return toolPath;
        },
        getPackageNameFromId: function(serviceUri: string, accessToken: string, projectId: string, feedId: string, packageId: string) {
            return packageId;
        }
    });
}

export function registerArtifactToolRunnerMock(tmr: tmrm.TaskMockRunner) {
    var mtt = require('azure-pipelines-task-lib/mock-toolrunner');
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/universal/ArtifactToolRunner', {
        getOptions: function() {
            return {
                cwd: process.cwd(),
                env: Object.assign({}, process.env),
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                windowsVerbatimArguments: false
            }
        },
        runArtifactTool: function(artifactToolPath: string, command: string[], execOptions) {
            var tr = new mtt.ToolRunner(artifactToolPath)
            tr.arg(command);
            return tr.execSync(execOptions);
        }
    });
}
