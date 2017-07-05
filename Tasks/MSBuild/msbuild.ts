import path = require('path');
import tl = require('vsts-task-lib/task');
import { ToolRunner } from 'vsts-task-lib/toolrunner';
import msbuildHelpers = require('msbuildhelpers/msbuildhelpers');

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read inputs
        let solution: string = tl.getPathInput('solution', true, false);
        let platform: string = tl.getInput('platform');
        let configuration: string = tl.getInput('configuration');
        let msbuildArguments: string = tl.getInput('msbuildArguments');
        let clean: boolean = tl.getBoolInput('clean');

        let logsolutionEvents: boolean = tl.getBoolInput('logsolutionEvents');
        if (logsolutionEvents) {
            tl.warning(tl.loc('RecordProjectDetailsOnlySupportedOnWindows'));
        }

        let createLogFile: boolean = tl.getBoolInput('createLogFile');
        if (createLogFile) {
            tl.warning(tl.loc('CreateLogFileOnlySupportedOnWindows'));
        }

        let msbuildLocationMethod: string = tl.getInput('msbuildLocationMethod');
        if (!msbuildLocationMethod) {
            msbuildLocationMethod = 'version';
        }

        let msbuildTool: string;
        if (msbuildLocationMethod === 'version') {
            let msbuildVersion: string = tl.getInput('msbuildVersion');
            msbuildTool = await msbuildHelpers.getMSBuildPath(msbuildVersion);
        }
        if (msbuildLocationMethod === 'location') {
            msbuildTool = tl.getInput('msbuildLocation');
        } 

        let filesList: string[] = tl.findMatch(null, solution, { followSymbolicLinks: false, followSpecifiedSymbolicLink: false }, { matchBase: true });
        for (let file of filesList) {
            if (clean) {
                let cleanTool: ToolRunner = tl.tool(msbuildTool);
                cleanTool.arg(file);
                cleanTool.argIf(clean, '/t:Clean');
                cleanTool.argIf(platform, '/p:Platform=' + platform);
                cleanTool.argIf(configuration, '/p:Configuration=' + configuration);
                if (msbuildArguments) {
                    cleanTool.line(msbuildArguments);
                }
                await cleanTool.exec();
            }

            let buildTool: ToolRunner = tl.tool(msbuildTool);
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
