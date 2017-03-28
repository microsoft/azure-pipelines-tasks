import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read inputs
        let solution = tl.getPathInput('solution', true, false);
        let platform = tl.getInput('platform');
        let configuration = tl.getInput('configuration');
        let msbuildArguments = tl.getInput('msbuildArguments');
        let clean = tl.getBoolInput('clean');

        let logsolutionEvents = tl.getBoolInput('logsolutionEvents');
        if (logsolutionEvents) {
            tl.warning(tl.loc('RecordProjectDetailsOnlySupportedOnWindows'));
        }

        let createLogFile = tl.getBoolInput('createLogFile');
        if (createLogFile) {
            tl.warning(tl.loc('CreateLogFileOnlySupportedOnWindows'));
        }

        let msbuildLocationMethod = tl.getInput('msbuildLocationMethod');
        if (!msbuildLocationMethod) {
            msbuildLocationMethod = 'version';
        }

        var xbuildToolPath = tl.which('xbuild'); //ignore msbuild version on non-Windows platforms, use xbuild
        if (msbuildLocationMethod == 'location') {
            xbuildToolPath = tl.getInput('msbuildLocation');
        }

        let filesList: string[] = tl.findMatch(null, solution, null, { matchBase: true });
        for (let file of filesList) {
            if (clean) {
                let cleanTool: ToolRunner = tl.tool(xbuildToolPath);
                cleanTool.arg(file);
                cleanTool.argIf(clean, '/t:Clean');
                cleanTool.argIf(platform, '/p:Platform=' + platform);
                cleanTool.argIf(configuration, '/p:Configuration=' + configuration);
                if (msbuildArguments) {
                    cleanTool.line(msbuildArguments);
                }
                await cleanTool.exec();
            }

            let buildTool: ToolRunner = tl.tool(xbuildToolPath);
            buildTool.arg(file);
            buildTool.argIf(platform, '/p:Platform=' + platform);
            buildTool.argIf(configuration, '/p:Configuration=' + configuration);
            if (msbuildArguments) {
                buildTool.line(msbuildArguments);
            }
            await buildTool.exec();
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();
