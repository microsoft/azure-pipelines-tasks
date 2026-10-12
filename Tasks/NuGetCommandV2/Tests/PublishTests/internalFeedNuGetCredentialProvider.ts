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

const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    osType: {},
    checkPath: {
        'c:\\agent\\home\\directory\\foo.nupkg': true
    },
    which: {},
    exec: {
        'c:\\from\\tool\\installer\\nuget.exe push c:\\agent\\home\\directory\\foo.nupkg -NonInteractive -Source https://vsts/packagesource -ApiKey VSTS': {
            code: 0,
            stdout: 'NuGet output here',
            stderr: ''
        }
    },
    exist: {},
    stats: {
        'c:\\agent\\home\\directory\\foo.nupkg': {
            isFile: true
        }
    },
    findMatch: {
        'foo.nupkg': ['c:\\agent\\home\\directory\\foo.nupkg']
    }
};
nmh.setAnswers(answers);

process.env.NUGET_FORCENUGETFORPUSH = 'true';
process.env.PUBLISH_VIA_SERVICE_CONNECTION = 'true';
process.env.VSS_NUGET_EXTERNAL_FEED_ENDPOINTS =
    '{"endpointCredentials":[{"endpoint":"https://example.visualstudio.com/defaultcollection","username":"build","password":"credential-provider-secret"}]}';

nmh.registerNugetUtilityMock(['c:\\agent\\home\\directory\\foo.nupkg']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
tmr.registerMock('azure-pipelines-tasks-utility-common/restutilities', {
    WebRequest: class {},
    sendRequest: async () => ({
        statusCode: 200,
        body: { resources: [] }
    })
});

tmr.run();
