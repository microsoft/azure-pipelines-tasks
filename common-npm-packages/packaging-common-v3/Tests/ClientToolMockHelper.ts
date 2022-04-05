import tmrm = require('azure-pipelines-task-lib/mock-run');

export function registerClientToolUtilitiesMock(tmr: tmrm.TaskMockRunner, toolPath: string) {
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/universal/ClientToolUtilities', {
        getClientToolFromService: function (serviceUri, accessToken, toolName) {
            return toolPath;
        },
        getBlobstoreUriFromBaseServiceUri: function (serviceUri: string, accesstoken: string) {
            return serviceUri + "/blobstore"
        },
        getWebApiWithProxy: function (serviceUri: string, accessToken?: string) {
            return {
                vsoClient: {
                    getVersioningData: async function (ApiVersion: string, PackagingAreaName: string, PackageAreaId: string, Obj) {
                        return { requestUrl: 'foobar' };
                    }
                }
            }
        },
        getSystemAccessToken: function () {
            return "token";
        },
        retryOnExceptionHelper: async function <T>(action: () => Promise<T>, maxTries: number, retryIntervalInMilliseconds: number) {
            return await action();
        },
        retryOnNullOrExceptionHelper: async function <T>(action: () => Promise<T>, maxTries: number, retryIntervalInMilliseconds: number) {
            return await action();
        },
        trimEnd: function (data: string, trimChar: string) {
            return data;
        }
    });
}

export function registerClientToolRunnerMock(tmr: tmrm.TaskMockRunner) {
    var mtt = require('azure-pipelines-task-lib/mock-toolrunner');
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/universal/ClientToolRunner', {
        getOptions: function () {
            return {
                cwd: process.cwd(),
                env: Object.assign({}, process.env),
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                windowsVerbatimArguments: false
            }
        },
        runClientTool: function (clientToolPath: string, command: string[], execOptions) {
            var tr = new mtt.ToolRunner(clientToolPath)
            tr.arg(command);
            return tr.execSync(execOptions);
        }
    });
}