import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as sqGradle from 'azure-pipelines-tasks-codeanalysis-common/gradlesonar';
import { CodeAnalysisOrchestrator } from 'azure-pipelines-tasks-codeanalysis-common/Common/CodeAnalysisOrchestrator';
import { BuildOutput, BuildEngine } from 'azure-pipelines-tasks-codeanalysis-common/Common/BuildOutput';
import { PmdTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/PmdTool';
import { CheckstyleTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/CheckstyleTool';
import { FindbugsTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/FindbugsTool';
import { SpotbugsTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/SpotbugsTool';
import { IAnalysisTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/IAnalysisTool';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { getExecOptions, setJavaHome, setGradleOpts } from './Modules/environment';
import { configureWrapperScript, isMultiModuleProject } from './Modules/project-configuration';
import { enableCodeCoverageAsync, publishTestResults, publishCodeCoverageResultsAsync, resolveCodeCoveragePreset } from './Modules/code-coverage';
import { ICodeAnalysisResult, ICodeCoveragePreset, ICodeCoverageSettings, IPublishCodeCoverageSettings, ITaskResult } from './interfaces';
import { resolveTaskResult } from './Modules/utils';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Configure wrapperScript
        let wrapperScript: string = tl.getPathInput('wrapperScript', true, true);
        wrapperScript = configureWrapperScript(wrapperScript);

        // Set working directory
        const workingDirectory: string = tl.getPathInput('cwd', false, true);
        tl.cd(workingDirectory);

        const javaHomeSelection: string = tl.getInput('javaHomeSelection', true);
        const codeCoverageTool: string = tl.getInput('codeCoverageTool');
        const failIfCodeCoverageEmpty: boolean = tl.getBoolInput('failIfCoverageEmpty');
        const publishJUnitResults: boolean = tl.getBoolInput('publishJUnitResults');
        const testResultsFiles: string = tl.getInput('testResultsFiles', true);
        const inputTasks: string[] = tl.getDelimitedInput('tasks', ' ', true);
        const gradle5xOrHigher: boolean = tl.getBoolInput('gradle5xOrHigher');

        const isCodeCoverageOpted: boolean = (typeof codeCoverageTool !== 'undefined' && codeCoverageTool && codeCoverageTool.toLowerCase() !== 'none');
        const buildOutput: BuildOutput = new BuildOutput(tl.getVariable('System.DefaultWorkingDirectory'), BuildEngine.Gradle);

        //START: Get gradleRunner ready to run
        let gradleRunner: ToolRunner = tl.tool(wrapperScript);
        if (isCodeCoverageOpted && inputTasks.indexOf('clean') === -1) {
            gradleRunner.arg('clean'); //if user opts for code coverage, we append clean functionality to make sure any uninstrumented class files are removed
        }
        gradleRunner.line(tl.getInput('options', false));
        gradleRunner.arg(inputTasks);
        //END: Get gb ready to run

        // Set JAVA_HOME based on any user input
        setJavaHome(javaHomeSelection);

        // Set any provided gradle options
        const gradleOptions: string = tl.getInput('gradleOpts');
        setGradleOpts(gradleOptions);

        // START: Enable code coverage (if desired)
        const reportDirectoryName: string = 'CCReport43F6D5EF';
        const reportDirectory: string = path.join(workingDirectory, reportDirectoryName);

        let summaryFile: string = '';
        let reportingTaskName: string = '';

        try {
            if (isCodeCoverageOpted) {
                tl.debug('Option to enable code coverage was selected and is being applied.');
                const classFilter: string = tl.getInput('classFilter');
                const classFilesDirectories: string = tl.getInput('classFilesDirectories');

                // START: determine isMultiModule
                const isMultiModule: boolean = isMultiModuleProject(wrapperScript);
                const codeCoveragePreset: ICodeCoveragePreset = resolveCodeCoveragePreset(codeCoverageTool, isMultiModule);

                summaryFile = path.join(reportDirectory, codeCoveragePreset.summaryFileName);
                reportingTaskName = codeCoveragePreset.reportingTaskName;
                // END: determine isMultiModule

                // Clean the report directory before enabling code coverage
                tl.rmRF(reportDirectory);

                const codeCoverageSettings: ICodeCoverageSettings = {
                    wrapperScript: wrapperScript,
                    isCodeCoverageOpted: isCodeCoverageOpted,
                    classFilter: classFilter,
                    classFilesDirectories: classFilesDirectories,
                    codeCoverageTool: codeCoverageTool,
                    workingDirectory: workingDirectory,
                    reportDirectoryName: reportDirectoryName,
                    summaryFileName: codeCoveragePreset.summaryFileName,
                    isMultiModule: isMultiModule,
                    gradle5xOrHigher: gradle5xOrHigher
                };

                await enableCodeCoverageAsync(codeCoverageSettings);
            }

            tl.debug('Enabled code coverage successfully');
        } catch (err) {
            tl.warning(`Failed to enable code coverage: ${err}`);
        }

        if (reportingTaskName && reportingTaskName !== '') {
            gradleRunner.arg(reportingTaskName);
        }
        // END: Enable code coverage (if desired)

        const codeAnalysisTools: IAnalysisTool[] = [
            new CheckstyleTool(buildOutput, 'checkstyleAnalysisEnabled'),
            new FindbugsTool(buildOutput, 'findbugsAnalysisEnabled'),
            new PmdTool(buildOutput, 'pmdAnalysisEnabled'),
            new SpotbugsTool(buildOutput, 'spotBugsAnalysisEnabled')
        ];
        const codeAnalysisOrchestrator: CodeAnalysisOrchestrator = new CodeAnalysisOrchestrator(codeAnalysisTools);

        // Enable SonarQube Analysis (if desired)
        const isSonarQubeEnabled: boolean = tl.getBoolInput('sqAnalysisEnabled', false);
        if (isSonarQubeEnabled) {
            // Looks like: 'SonarQube analysis is enabled.'
            console.log(tl.loc('codeAnalysis_ToolIsEnabled'), 'SonarQube');
            gradleRunner = <ToolRunner>sqGradle.applyEnabledSonarQubeArguments(gradleRunner);
        }
        gradleRunner = codeAnalysisOrchestrator.configureBuild(gradleRunner);

        // START: Run code analysis
        const codeAnalysisResult: ICodeAnalysisResult = {};

        try {
            codeAnalysisResult.gradleResult = await gradleRunner.exec(getExecOptions());
            codeAnalysisResult.statusFailed = false;
            codeAnalysisResult.analysisError = '';

            tl.debug(`Gradle result: ${codeAnalysisResult.gradleResult}`);
        } catch (err) {
            codeAnalysisResult.gradleResult = -1;
            codeAnalysisResult.statusFailed = true;
            codeAnalysisResult.analysisError = err;

            console.error(err);
            tl.debug('taskRunner fail');
        }

        tl.debug('Processing code analysis results');
        codeAnalysisOrchestrator.publishCodeAnalysisResults();

        // We should always publish test results and code coverage
        publishTestResults(publishJUnitResults, testResultsFiles);

        const publishCodeCoverageSettings: IPublishCodeCoverageSettings = {
            isCodeCoverageOpted: isCodeCoverageOpted,
            failIfCoverageEmpty: failIfCodeCoverageEmpty,
            codeCoverageTool: codeCoverageTool,
            summaryFile: summaryFile,
            reportDirectory: reportDirectory
        };
        await publishCodeCoverageResultsAsync(publishCodeCoverageSettings);

        const taskResult: ITaskResult = resolveTaskResult(codeAnalysisResult);
        tl.setResult(taskResult.status, taskResult.message);
        // END: Run code analysis
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();
