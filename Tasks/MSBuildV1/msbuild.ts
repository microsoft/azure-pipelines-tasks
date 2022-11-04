import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import msbuildHelpers = require('azure-pipelines-tasks-msbuildhelpers-v3/msbuildhelpers');
import { TelemetryPayload, emitTelemetry } from './telemetryHelper';

async function run() {
    const telemetry = {} as TelemetryPayload;
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read inputs
        let solution: string = tl.getPathInput('solution', true, false);
        let platform: string = tl.getInput('platform');
        let configuration: string = tl.getInput('configuration');
        let msbuildArguments: string = tl.getInput('msbuildArguments');
        let clean: boolean = tl.getBoolInput('clean');

        // pass inputs to telemetry object
        telemetry.configuration = configuration;
        telemetry.platform = platform;

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
        telemetry.msBuildLocationMethod = msbuildLocationMethod;

        let msbuildTool: string;
        if (msbuildLocationMethod === 'version') {
            let msbuildVersion: string = tl.getInput('msbuildVersion');
            telemetry.msBuildVersion = msbuildVersion;
            msbuildTool = await msbuildHelpers.getMSBuildPath(msbuildVersion);
        }
        if (msbuildLocationMethod === 'location') {
            msbuildTool = tl.getInput('msbuildLocation');
        }

        let filesList: string[] = tl.findMatch(null, solution, { followSymbolicLinks: false, followSpecifiedSymbolicLink: false, allowBrokenSymbolicLinks: false }, { matchBase: true });
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

            const startExecTime = new Date().getTime();
            await buildTool.exec();
            const endExecTime = new Date().getTime();

            const executionTime = (endExecTime - startExecTime) / 1000; // need to convert from milliseconds to seconds
            telemetry.msbuildExectionTimeSeconds = executionTime;
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        emitTelemetry(telemetry);
    }
}

run();
