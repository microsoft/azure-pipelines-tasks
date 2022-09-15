import * as tl from 'azure-pipelines-task-lib/task';
import fs = require('fs');
import path = require('path');
import Q = require('q');
import os = require('os');

import { ToolRunner, IExecOptions } from 'azure-pipelines-task-lib/toolrunner';

import sqGradle = require('azure-pipelines-tasks-codeanalysis-common/gradlesonar');
import { CodeAnalysisOrchestrator } from 'azure-pipelines-tasks-codeanalysis-common/Common/CodeAnalysisOrchestrator';
import { BuildOutput, BuildEngine } from 'azure-pipelines-tasks-codeanalysis-common/Common/BuildOutput';
import { PmdTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/PmdTool';
import { CheckstyleTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/CheckstyleTool';
import { FindbugsTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/FindbugsTool';
import { SpotbugsTool } from 'azure-pipelines-tasks-codeanalysis-common/Common/SpotbugsTool';
import { CodeCoverageEnablerFactory } from 'azure-pipelines-tasks-codecoverage-tools/codecoveragefactory';
import { ICodeCoverageEnabler } from 'azure-pipelines-tasks-codecoverage-tools/codecoverageenabler';
import ccUtil = require('azure-pipelines-tasks-codecoverage-tools/codecoverageutilities');
import javacommons = require('azure-pipelines-tasks-java-common/java-common');

// Setting the access token env var to both VSTS and AZURE_ARTIFACTS for 
// backwards compatibility with repos that already use the older env var.
const accessTokenEnvSettingLegacy: string = 'VSTS_ENV_ACCESS_TOKEN';
const accessTokenEnvSetting: string = 'AZURE_ARTIFACTS_ENV_ACCESS_TOKEN';
const TESTRUN_SYSTEM = "VSTS - gradle"; 

// Configure the JVM associated with this run.
function setGradleOpts(gradleOptions: string): void {
    if (gradleOptions) {
        process.env['GRADLE_OPTS'] = gradleOptions;
        tl.debug(`GRADLE_OPTS is now set to ${gradleOptions}`);
    }
}

function publishTestResults(publishJUnitResults: boolean, testResultsFiles: string): number {
    if (publishJUnitResults) {
        let matchingTestResultsFiles: string[] = [];
        // check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');
            let buildFolder: string = tl.getVariable('System.DefaultWorkingDirectory');
            // the find options are as default, except the `skipMissingFiles` option is set to `true`
            // so there will be a warning instead of an error if an item will not be found
            const findOpitons: tl.FindOptions = {
                allowBrokenSymbolicLinks: false,
                followSpecifiedSymbolicLink: true,
                followSymbolicLinks: true,
                skipMissingFiles: true
            };
            matchingTestResultsFiles = tl.findMatch(buildFolder, testResultsFiles, findOpitons, { matchBase: true });
        } else {
            tl.debug('No pattern found in testResultsFiles parameter');
            matchingTestResultsFiles = [testResultsFiles];
        }

        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            console.log(tl.loc('NoTestResults', testResultsFiles));
            return 0;
        }

        let tp: tl.TestPublisher = new tl.TestPublisher('JUnit');
        const testRunTitle = tl.getInput('testRunTitle');
        tp.publish(matchingTestResultsFiles, 'true', '', '', testRunTitle, 'true', TESTRUN_SYSTEM);
    }
}

function enableCodeCoverage(wrapperScript: string, isCodeCoverageOpted: boolean,
                            classFilter: string, classFilesDirectories: string,
                            codeCoverageTool: string, workingDirectory: string,
                            reportDirectoryName: string, summaryFileName: string,
                            isMultiModule: boolean, gradle5xOrHigher: boolean, isAndroidProject: boolean): Q.Promise<boolean> {
    let buildProps: { [key: string]: string } = {};
    buildProps['buildfile'] = path.join(workingDirectory, 'build.gradle');
    buildProps['classfilter'] = classFilter;
    buildProps['classfilesdirectories'] = classFilesDirectories;
    buildProps['summaryfile'] = summaryFileName;
    buildProps['reportdirectory'] = reportDirectoryName;
    buildProps['ismultimodule'] = String(isMultiModule);
    buildProps['gradle5xOrHigher'] = String(gradle5xOrHigher);
    buildProps['isAndroidProject'] = String(isAndroidProject);

    let ccEnabler: ICodeCoverageEnabler = new CodeCoverageEnablerFactory().getTool('gradle', codeCoverageTool.toLowerCase());
    return ccEnabler.enableCodeCoverage(buildProps);
}

function isMultiModuleProject(wrapperScript: string): boolean {
    let gradleBuild: ToolRunner = tl.tool(wrapperScript);
    gradleBuild.arg('properties');
    gradleBuild.line(tl.getInput('options', false));

    let data: string = gradleBuild.execSync().stdout;
    if (typeof data !== 'undefined' && data) {
        let regex: RegExp = new RegExp('subprojects: .*');
        let subProjects: RegExpExecArray = regex.exec(data);
        tl.debug('Data: ' + subProjects);

        if (typeof subProjects !== 'undefined' && subProjects && subProjects.length > 0) {
            tl.debug('Sub Projects info: ' + subProjects.toString());
            return (subProjects.join(',').toLowerCase() !== 'subprojects: []');
        }
    }
    return false;
}


async function publishCodeCoverage(isCodeCoverageOpted: boolean, failIfCoverageEmpty: boolean,
                             codeCoverageTool: string, summaryFile: string, reportDirectory: string) {
    if (isCodeCoverageOpted) {
        tl.debug('publishCodeCoverage');
        if (failIfCoverageEmpty && await ccUtil.isCodeCoverageFileEmpty(summaryFile, codeCoverageTool)) {
            throw tl.loc('NoCodeCoverage');
        }
        if (tl.exist(summaryFile)) {
            tl.debug('Summary file = ' + summaryFile);
            tl.debug('Report directory = ' + reportDirectory);
            tl.debug('Publishing code coverage results to TFS');
            let ccPublisher: tl.CodeCoveragePublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish(codeCoverageTool, summaryFile, reportDirectory, '');
        } else {
            tl.warning('No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the gradle output for details.');
        }
    }
}

function configureWrapperScript(wrapperScript: string): string {
    let script: string = wrapperScript;
    let isWindows: RegExpMatchArray = os.type().match(/^Win/);
    if (isWindows) {
        // append .bat extension name on Windows platform
        if (!script.endsWith('bat')) {
            tl.debug('Append .bat extension name to gradlew script.');
            script += '.bat';
        }
    }
    if (fs.existsSync(script)) {
        // (The exists check above is not necessary, but we need to avoid this call when we are running L0 tests.)
        // Make sure the wrapper script is executable
        fs.chmodSync(script, '755');
    }
    return script;
}

// update JAVA_HOME if user selected specific JDK version or set path manually
function setJavaHome(javaHomeSelection: string): void {
    let specifiedJavaHome: string;
    let javaTelemetryData;

    if (javaHomeSelection === 'JDKVersion') {
        tl.debug('Using JDK version to find and set JAVA_HOME');
        let jdkVersion: string = tl.getInput('jdkVersion');
        let jdkArchitecture: string = tl.getInput('jdkArchitecture');
        javaTelemetryData = { "jdkVersion": jdkVersion };
        
        if (jdkVersion !== 'default') {
            specifiedJavaHome = javacommons.findJavaHome(jdkVersion, jdkArchitecture);
        }
    } else {
        tl.debug('Using path from user input to set JAVA_HOME');
        let jdkUserInputPath: string = tl.getPathInput('jdkUserInputPath', true, true);
        specifiedJavaHome = jdkUserInputPath;
        javaTelemetryData = { "jdkVersion": "custom" };
    }
    javacommons.publishJavaTelemetry('Gradle', javaTelemetryData);
    
    if (specifiedJavaHome) {
        tl.debug('Set JAVA_HOME to ' + specifiedJavaHome);
        process.env['JAVA_HOME'] = specifiedJavaHome;
    }
}

function getExecOptions(): IExecOptions {
    var env = process.env;
    env[accessTokenEnvSetting] = env[accessTokenEnvSettingLegacy] = getSystemAccessToken();
    return <IExecOptions> {
        env: env,
    };
}

function getSystemAccessToken(): string {
    tl.debug('Getting credentials for account feeds');
    let auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth && auth.scheme === 'OAuth') {
        tl.debug('Got auth token');
        return auth.parameters['AccessToken'];
    }
    tl.warning(tl.loc('FeedTokenUnavailable'));
    return '';
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Configure wrapperScript
        let wrapperScript: string = tl.getPathInput('wrapperScript', true, true);
        wrapperScript = configureWrapperScript(wrapperScript);

        // Set working directory
        let workingDirectory: string = tl.getPathInput('cwd', false, true);
        tl.cd(workingDirectory);

        let javaHomeSelection: string = tl.getInput('javaHomeSelection', true);
        let codeCoverageTool: string = tl.getInput('codeCoverageTool');
        let isCodeCoverageOpted: boolean = (typeof codeCoverageTool !== 'undefined' && codeCoverageTool && codeCoverageTool.toLowerCase() !== 'none');
        let failIfCodeCoverageEmpty: boolean = tl.getBoolInput('failIfCoverageEmpty');
        let publishJUnitResults: boolean = tl.getBoolInput('publishJUnitResults');
        let testResultsFiles: string = tl.getInput('testResultsFiles', true);
        let inputTasks: string[] = tl.getDelimitedInput('tasks', ' ', true);
        let buildOutput: BuildOutput = new BuildOutput(tl.getVariable('System.DefaultWorkingDirectory'), BuildEngine.Gradle);
        let gradle5xOrHigher: boolean = tl.getBoolInput('gradle5xOrHigher');
        let isAndroidProj: boolean = isAndroidProject(wrapperScript);

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
        let gradleOptions: string = tl.getInput('gradleOpts');
        setGradleOpts(gradleOptions);

        // START: Enable code coverage (if desired)
        let reportDirectoryName: string = 'CCReport43F6D5EF';
        let reportDirectory: string = path.join(workingDirectory, reportDirectoryName);
        let summaryFile: string = null;
        let reportingTaskName: string = '';
        try {
            if (isCodeCoverageOpted) {
                tl.debug('Option to enable code coverage was selected and is being applied.');
                let classFilter: string = tl.getInput('classFilter');
                let classFilesDirectories: string = tl.getInput('classFilesDirectories');

                // START: determine isMultiModule
                let isMultiModule: boolean = isMultiModuleProject(wrapperScript);
                let summaryFileName: string;
                if (codeCoverageTool.toLowerCase() === 'jacoco') {
                    summaryFileName = 'summary.xml';
                    if (isMultiModule) {
                        reportingTaskName = 'jacocoRootReport';
                    } else {
                        reportingTaskName = 'jacocoTestReport';
                    }
                } else if (codeCoverageTool.toLowerCase() === 'cobertura') {
                    summaryFileName = 'coverage.xml';
                    reportingTaskName = 'cobertura';
                }
                summaryFile = path.join(reportDirectory, summaryFileName);
                // END: determine isMultiModule

                // Clean the report directory before enabling code coverage
                tl.rmRF(reportDirectory);
                await enableCodeCoverage(wrapperScript, isCodeCoverageOpted,
                                         classFilter, classFilesDirectories,
                                         codeCoverageTool, workingDirectory, reportDirectoryName,
                                         summaryFileName, isMultiModule, gradle5xOrHigher, isAndroidProj);
            }
            tl.debug('Enabled code coverage successfully');
        } catch (err) {
            tl.warning('Failed to enable code coverage: ' + err);
        }
        if (reportingTaskName && reportingTaskName !== '') {
            gradleRunner.arg(reportingTaskName);
        }
        // END: Enable code coverage (if desired)

        let codeAnalysisOrchestrator: CodeAnalysisOrchestrator = new CodeAnalysisOrchestrator(
            [new CheckstyleTool(buildOutput, 'checkstyleAnalysisEnabled'),
            new FindbugsTool(buildOutput, 'findbugsAnalysisEnabled'),
            new PmdTool(buildOutput, 'pmdAnalysisEnabled'),
            new SpotbugsTool(buildOutput, "spotBugsAnalysisEnabled")]);

        // Enable SonarQube Analysis (if desired)
        let isSonarQubeEnabled: boolean = tl.getBoolInput('sqAnalysisEnabled', false);
        if (isSonarQubeEnabled) {
            // Looks like: 'SonarQube analysis is enabled.'
            console.log(tl.loc('codeAnalysis_ToolIsEnabled'), 'SonarQube');
            gradleRunner = <ToolRunner> sqGradle.applyEnabledSonarQubeArguments(gradleRunner);
        }
        gradleRunner = codeAnalysisOrchestrator.configureBuild(gradleRunner);

        // START: Run code analysis
        let gradleResult: number;
        let statusFailed: boolean = false;
        let analysisError: any;
        try {
            gradleResult = await gradleRunner.exec(getExecOptions());
            tl.debug(`Gradle result: ${gradleResult}`);
        } catch (err) {
            console.error(err);
            tl.debug('taskRunner fail');
            gradleResult = -1;
            statusFailed = true;
            analysisError = err;
        }
        tl.debug('Processing code analysis results');
        codeAnalysisOrchestrator.publishCodeAnalysisResults();

        // We should always publish test results and code coverage
        publishTestResults(publishJUnitResults, testResultsFiles);
        await publishCodeCoverage(isCodeCoverageOpted, failIfCodeCoverageEmpty, codeCoverageTool, summaryFile, reportDirectory);

        if (gradleResult === 0) {
            tl.setResult(tl.TaskResult.Succeeded, 'Build succeeded.');
        } else if (gradleResult === -1 && statusFailed === true) {
            tl.setResult(tl.TaskResult.Failed, analysisError);
        } else {
            tl.setResult(tl.TaskResult.Failed, 'Build failed.');
        }
        // END: Run code analysis
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

function isAndroidProject(wrapperScript: string): boolean {
    const gradleBuild: ToolRunner = tl.tool(wrapperScript);
    gradleBuild.arg('buildEnvironment');
    gradleBuild.line(tl.getInput('options', false));

    const data: string = gradleBuild.execSync().stdout;
    if (typeof data !== 'undefined' && data) {
        // com.android.application is a Gradle plugin to build android projects
        const regex: RegExp = new RegExp('com\.android\.application');
        const andpoidGradlePlugin: RegExpExecArray = regex.exec(data);
        if (typeof andpoidGradlePlugin !== 'undefined' && andpoidGradlePlugin && andpoidGradlePlugin.length > 0) {
            tl.debug('It\'s Android project');
            return true;
        }
    }
    return false;
}

run();
