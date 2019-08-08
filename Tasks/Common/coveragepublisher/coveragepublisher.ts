
import * as toolRunner from 'azure-pipelines-task-lib/toolrunner';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import * as path from 'path';

export async function PublishCodeCoverage(inputFiles: Array<string>,  sourceDirectory?: string) {
    
}


async function publishCoverage(summaryFile: string, targetDir: string, pathToSources: string): Promise<boolean> {
    const osvar = process.platform;
    let dotnet: toolRunner.ToolRunner;

    const dotnetPath = taskLib.which('dotnet', false);
    if (!dotnetPath && osvar !== 'win32') {
        taskLib.warning(taskLib.loc('InstallDotNetCoreForHtmlReport'));
        return false;
    }

    // if (!dotnetPath && osvar === 'win32') {
    //     // use full .NET to execute
    //     dotnet = taskLib.tool(path.join(__dirname, 'net47', 'ReportGenerator.exe'));
    // } else {
    //     dotnet = taskLib.tool(dotnetPath);
    //     dotnet.arg(path.join(__dirname, 'netcoreapp2.0', 'ReportGenerator.dll'));
    // }

    dotnet.arg('-reports:' + summaryFile);
    dotnet.arg('-targetdir:' + targetDir);
    dotnet.arg('-reporttypes:HtmlInline_AzurePipelines');

    if (!isNullOrWhitespace(pathToSources)) {
        dotnet.arg('-sourceDirectory:' + pathToSources);
    }

    try {
        const result = await dotnet.exec({
            ignoreReturnCode: true,
            failOnStdErr: false,
            windowsVerbatimArguments: true,
            errStream: process.stdout,
            outStream: process.stdout
        } as any);

        // Listen for stderr.
        let isError = false;
        dotnet.on('stderr', () => {
            isError = true;
        });

        if (result === 0 && !isError) {
            console.log(taskLib.loc('GeneratedHtmlReport', targetDir));
            return true;
        } else {
            taskLib.warning(taskLib.loc('FailedToGenerateHtmlReport', result));
        }
    } catch (err) {
        taskLib.warning(taskLib.loc('FailedToGenerateHtmlReport', err));
    }
    return false;
}


function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function getTempFolder(): string {
    try {
        taskLib.assertAgent('2.115.0');
        const tmpDir = taskLib.getVariable('Agent.TempDirectory');
        return tmpDir;
    } catch (err) {
        taskLib.warning(taskLib.loc('UpgradeAgentMessage'));
        return os.tmpdir();
    }
}
