import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function run() {
    try {
        // Set path to resource strings
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Change to configured working directory
        tl.cd(tl.getPathInput('cwd', true, true));

        // Set locale to UTF-8
        tl.debug('Setting locale to UTF8 as required by CocoaPods');
        process.env['LC_ALL'] = 'en_US.UTF-8';

        // Locate the CocoaPods 'pod' command
        var podPath: string = tl.which('pod');
        if (!podPath) {
            throw new Error(tl.loc('CocoaPodsNotFound'));
        }

        // Run 'pod install'
        var pod: trm.ToolRunner = tl.tool(podPath);
        pod.arg('install');

        // Get the result code and set the task result accordingly
        var code: number = await pod.exec();
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('PodReturnCode', code));
    }
    catch(err) {
        // Report failure
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('PodFailed', err.message));
    }
}

run();
