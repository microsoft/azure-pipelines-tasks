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
    exec: {},
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

process.env['NUGET_FORCEVSTSNUGETPUSHFORPUSH'] = 'true';
process.env['SYSTEM_SERVERTYPE'] = 'Hosted';

tmr.registerMock('./Common/VstsNuGetPushToolRunner', {
    createVstsNuGetPushToolRunner: function (_vstsNuGetPushPath: string, settings: any) {
        if (!settings || settings.timeoutInMs !== 12345 || settings.continueOnConflict !== false) {
            throw new Error('Expected request timeout to be passed to VstsNuGetPush settings');
        }

        console.log('validated VstsNuGetPush timeout');

        return {
            arg: function (_value: any) {
                return;
            },
            on: function (_eventName: string, _handler: Function) {
                return;
            },
            exec: async function () {
                return 0;
            },
        };
    },
});

nmh.registerNugetUtilityMock(['c:\\agent\\home\\directory\\foo.nupkg']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerVstsNuGetPushRunnerMock();

tmr.run();