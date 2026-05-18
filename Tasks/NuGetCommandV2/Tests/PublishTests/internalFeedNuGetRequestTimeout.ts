import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../NugetMockHelper');

const taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'push');
tmr.setInput('searchPatternPush', 'foo.nupkg');
tmr.setInput('nuGetFeedType', 'internal');
tmr.setInput('feedPublish', 'FeedFooId');
tmr.setInput('allowPackageConflicts', 'false');
tmr.setInput('requestTimeout', '12345');

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    osType: {},
    checkPath: {
        'c:\\agent\\home\\directory\\foo.nupkg': true,
    },
    which: {},
    exec: {
        'c:\\from\\tool\\installer\\nuget.exe push c:\\agent\\home\\directory\\foo.nupkg -NonInteractive -Source https://vsts/packagesource -ApiKey VSTS -Timeout 13': {
            code: 0,
            stdout: 'NuGet output here',
            stderr: '',
        },
    },
    exist: {},
    stats: {
        'c:\\agent\\home\\directory\\foo.nupkg': {
            isFile: true,
        },
    },
    findMatch: {
        'foo.nupkg': ['c:\\agent\\home\\directory\\foo.nupkg'],
    },
};
nmh.setAnswers(a);

process.env['NUGET_FORCENUGETFORPUSH'] = 'true';
process.env['PUBLISH_VIA_SERVICE_CONNECTION'] = 'true';
process.env['VSS_NUGET_EXTERNAL_FEED_ENDPOINTS'] = JSON.stringify({
    endpointCredentials: [
        {
            endpoint: 'https://matching.example/feed/index.json',
            username: 'service-connection',
            password: 'service-connection-token',
        },
    ],
});

tmr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    ProtocolType: {
        NuGet: 'NuGet',
    },
    getPackagingUris: async function (protocolType: string, options: any) {
        if (protocolType !== 'NuGet') {
            throw new Error(`Unexpected protocol type: ${protocolType}`);
        }

        if (!options || options.socketTimeout !== 12345 || !options.globalAgentOptions || options.globalAgentOptions.timeout !== 12345) {
            throw new Error('Expected request timeout to be passed to getPackagingUris');
        }

        console.log('validated packaging request timeout');

        return {
            DefaultPackagingUri: 'https://vsts',
            PackagingUris: ['https://matching.example/'],
        };
    },
    getSystemAccessToken: function () {
        return 'token';
    },
});

tmr.registerMock('azure-pipelines-tasks-utility-common/restutilities', {
    WebRequest: function () {
        return {};
    },
    sendRequest: async function (_request: any, options: any) {
        if (!options || options.socketTimeout !== 12345 || !options.httpGlobalAgentOptions || options.httpGlobalAgentOptions.timeout !== 12345) {
            throw new Error('Expected request timeout to be passed to sendRequest');
        }

        console.log('validated service connection request timeout');

        return {
            statusCode: 200,
            body: {
                resources: [
                    {
                        '@type': 'VssFeedId',
                        label: 'FeedFooId',
                        '@id': 'https://matching.example/FeedFooId',
                    },
                ],
            },
        };
    },
});

nmh.registerNugetUtilityMock(['c:\\agent\\home\\directory\\foo.nupkg']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();