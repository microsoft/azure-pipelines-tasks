import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function run() {
    try {   
		tl.setResourcePath(path.join( __dirname, 'task.json'));

        tl.cd(tl.getPathInput('cwd', true, true));
        tl.debug('Setting locale to UTF8 - required by CocoaPods');
        process.env['LC_ALL'] = 'en_US.UTF-8';

        var podPath: string = tl.which('pod');
        if (!podPath) {

        }

        var pod: trm.ToolRunner = tl.tool(podPath);
        pod.arg('install');

		var code: number = await pod.exec();
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('PodReturnCode', code));
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('PodFailed', err.message));
    }
}
