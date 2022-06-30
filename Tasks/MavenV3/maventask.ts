
import Q = require('q');
import os = require('os');
import path = require('path');
import fs = require('fs');

import * as tl from 'azure-pipelines-task-lib/task';
import {ToolRunner} from 'azure-pipelines-task-lib/toolrunner';
import {CodeCoverageEnablerFactory} from 'azure-pipelines-tasks-codecoverage-tools/codecoveragefactory';
import {CodeAnalysisOrchestrator} from "azure-pipelines-tasks-codeanalysis-common/Common/CodeAnalysisOrchestrator";
import {BuildOutput, BuildEngine} from 'azure-pipelines-tasks-codeanalysis-common/Common/BuildOutput';
import {CheckstyleTool} from 'azure-pipelines-tasks-codeanalysis-common/Common/CheckstyleTool';
import {PmdTool} from 'azure-pipelines-tasks-codeanalysis-common/Common/PmdTool';
import {FindbugsTool} from 'azure-pipelines-tasks-codeanalysis-common/Common/FindbugsTool';
import javacommons = require('azure-pipelines-tasks-java-common/java-common');
import * as jsdom from 'jsdom';
const { JSDOM } = jsdom;

import * as util from './utils/mavenutil';
import * as spotbugsTool from './spotbugsTool';

const TESTRUN_SYSTEM = "VSTS - maven";
var isWindows = os.type().match(/^Win/);

// Set up localization resource file
tl.setResourcePath(path.join( __dirname, 'task.json'));

var mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);
var javaHomeSelection: string = tl.getInput('javaHomeSelection', true);
var mavenVersionSelection: string = tl.getInput('mavenVersionSelection', true);
var mavenGoals: string[] = tl.getDelimitedInput('goals', ' ', true); // This assumes that goals cannot contain spaces
var mavenOptions: string = tl.getInput('options', false); // Options can have spaces and quotes so we need to treat this as one string and not try to parse it
var publishJUnitResults: boolean = tl.getBoolInput('publishJUnitResults');
var testResultsFiles: string = tl.getInput('testResultsFiles', true);
var ccTool = tl.getInput('codeCoverageTool');
var authenticateFeed = tl.getBoolInput('mavenFeedAuthenticate', true);
var skipEffectivePomGeneration = tl.getBoolInput("skipEffectivePom", false);
var isCodeCoverageOpted = (typeof ccTool != "undefined" && ccTool && ccTool.toLowerCase() != 'none');
var failIfCoverageEmptySetting: boolean = tl.getBoolInput('failIfCoverageEmpty');
const restoreOriginalPomXml: boolean = tl.getBoolInput('restoreOriginalPomXml');
const isSpotbugsAnalysisEnabled: boolean = tl.getBoolInput('spotBugsAnalysisEnabled', false);
const spotBugsGoal: string = tl.getInput('spotBugsGoal');
const isFailWhenBugsFoundBySpotbugs: boolean = tl.getBoolInput('spotBugsFailWhenBugsFound', false);

var codeCoverageFailed: boolean = false;
var summaryFile: string = null;
var reportDirectory: string = null;
var reportPOMFile: string = null;
var execFileJacoco: string = null;
var ccReportTask: string = null;

let buildOutput: BuildOutput = new BuildOutput(tl.getVariable('System.DefaultWorkingDirectory'), BuildEngine.Maven);
var codeAnalysisOrchestrator:CodeAnalysisOrchestrator = new CodeAnalysisOrchestrator(
    [new CheckstyleTool(buildOutput, 'checkstyleAnalysisEnabled'),
        new FindbugsTool(buildOutput, 'findbugsAnalysisEnabled'),
        new PmdTool(buildOutput, 'pmdAnalysisEnabled')]);

// Determine the version and path of Maven to use
var mvnExec: string = '';

if (mavenVersionSelection == 'Path') {
    // The path to Maven has been explicitly specified
    tl.debug('Using Maven path from user input');
    var mavenPath = tl.getPathInput('mavenPath', true, true);
    mvnExec = path.join(mavenPath, 'bin', 'mvn');

    // Set the M2_HOME variable to a custom Maven installation path?
    if (tl.getBoolInput('mavenSetM2Home')) {
        tl.setVariable('M2_HOME', mavenPath);
    }
}

else {
    // mavenVersionSelection is set to 'Default'

    // First, look for Maven in the M2_HOME variable
    var m2HomeEnvVar: string = null;
    m2HomeEnvVar = tl.getVariable('M2_HOME');
    if (m2HomeEnvVar) {
        tl.debug('Using M2_HOME environment variable value for Maven path: ' + m2HomeEnvVar);
        mvnExec = path.join(m2HomeEnvVar, 'bin', 'mvn');
    }
    // Second, look for Maven in the system path
    else {
        tl.debug('M2_HOME environment variable is not set, so Maven will be sought in the system path');
        mvnExec = tl.which('mvn', true);
    }
}

// On Windows, append .cmd or .bat to the executable as necessary
if (isWindows &&
    !mvnExec.toLowerCase().endsWith('.cmd') &&
    !mvnExec.toLowerCase().endsWith('.bat')) {
    if (tl.exist(mvnExec + '.cmd')) {
        // Maven 3 uses mvn.cmd
        mvnExec += '.cmd';
    }
    else if (tl.exist(mvnExec + '.bat')) {
        // Maven 2 uses mvn.bat
        mvnExec += '.bat';
    }
}

tl.checkPath(mvnExec, 'maven path');
tl.debug('Maven executable: ' + mvnExec);

// Set JAVA_HOME to the JDK version (default, 1.7, 1.8, etc.) or the path specified by the user
var specifiedJavaHome: string = null;
var javaTelemetryData = null;
if (javaHomeSelection == 'JDKVersion') {
    // Set JAVA_HOME to the specified JDK version (default, 1.7, 1.8, etc.)
    tl.debug('Using the specified JDK version to find and set JAVA_HOME');
    var jdkVersion: string = tl.getInput('jdkVersion');
    var jdkArchitecture: string = tl.getInput('jdkArchitecture');
    javaTelemetryData = { "jdkVersion": jdkVersion };
    if (jdkVersion != 'default') {
        specifiedJavaHome = javacommons.findJavaHome(jdkVersion, jdkArchitecture);
    }
}
else {
    // Set JAVA_HOME to the path specified by the user
    tl.debug('Setting JAVA_HOME to the path specified by user input');
    var jdkUserInputPath: string = tl.getPathInput('jdkUserInputPath', true, true);
    specifiedJavaHome = jdkUserInputPath;
    javaTelemetryData = { "jdkVersion": "custom" };
}
javacommons.publishJavaTelemetry('Maven', javaTelemetryData);

// Set JAVA_HOME as determined above (if different than default)
if (specifiedJavaHome) {
    tl.setVariable('JAVA_HOME', specifiedJavaHome);
}

async function execBuild() {
    // Maven task orchestration occurs as follows:
    // 1. Check that Maven exists by executing it to retrieve its version.
    // 2. Apply any goals for static code analysis tools selected by the user.
    // 3. Run Maven. Compilation or test errors will cause this to fail.
    //    In case the build has failed, the analysis will still succeed but the report will have less data. 
    // 4. Attempt to collate and upload static code analysis build summaries and artifacts.
    // 5. Always publish test results even if tests fail, causing this task to fail.
    // 6. If #3 or #4 above failed, exit with an error code to mark the entire step as failed.

    ccReportTask = await execEnableCodeCoverage();
    var userRunFailed: boolean = false;
    var codeAnalysisFailed: boolean = false;

    // Setup tool runner that executes Maven only to retrieve its version
    var mvnGetVersion = tl.tool(mvnExec);
    mvnGetVersion.arg('-version');

    configureMavenOpts();

    // 1. Check that Maven exists by executing it to retrieve its version.
    let settingsXmlFile: string = null;
    await mvnGetVersion.exec()
        .fail(function (err) {
            console.error("Maven is not installed on the agent");
            tl.setResult(tl.TaskResult.Failed, "Build failed."); // tl.exit sets the step result but does not stop execution
            process.exit(1);
        })
        .then(function (code) {
            // Setup tool runner to execute Maven goals
            if (authenticateFeed) {
                var repositories;

                if (skipEffectivePomGeneration) {
                    var pomContents = fs.readFileSync(mavenPOMFile, "utf8");
                    repositories = util.collectFeedRepositories(pomContents);
                } else {
                    var mvnRun = tl.tool(mvnExec);
                    mvnRun.arg('-f');
                    mvnRun.arg(mavenPOMFile);
                    mvnRun.arg('help:effective-pom');
                    if (mavenOptions) {
                        mvnRun.line(mavenOptions);
                    }
                    repositories = util.collectFeedRepositoriesFromEffectivePom(mvnRun.execSync()['stdout']);
                }
                return repositories
                .then(function (repositories) {
                    if (!repositories || !repositories.length) {
                        tl.debug('No built-in repositories were found in pom.xml');
                        util.publishMavenInfo(tl.loc('AuthenticationNotNecessary'));
                        return Q.resolve(true);
                    }
                    tl.debug('Repositories: ' + JSON.stringify(repositories));
                    let mavenFeedInfo: string = '';
                    for (let i = 0; i < repositories.length; ++i) {
                        if (repositories[i].id) {
                            mavenFeedInfo = mavenFeedInfo.concat(tl.loc('UsingAuthFeed')).concat(repositories[i].id + '\n');
                        }
                    }
                    util.publishMavenInfo(mavenFeedInfo);

                    settingsXmlFile = path.join(tl.getVariable('Agent.TempDirectory'), 'settings.xml');
                    tl.debug('checking to see if there are settings.xml in use');
                    let options: RegExpMatchArray = mavenOptions ? mavenOptions.match(/([^" ]*("([^"\\]*(\\.[^"\\]*)*)")[^" ]*)|[^" ]+/g) : undefined;
                    if (options) {
                        mavenOptions = '';
                        for (let i = 0; i < options.length; ++i) {
                            if ((options[i] === '--settings' || options[i] === '-s') && (i + 1) < options.length) {
                                i++; // increment to the file name
                                let suppliedSettingsXml: string = path.resolve(tl.cwd(), options[i]);
                                // Avoid copying settings file to itself
                                if (path.relative(suppliedSettingsXml, settingsXmlFile) !== '') {
                                    tl.cp(suppliedSettingsXml, settingsXmlFile, '-f');
                                } else {
                                    tl.debug('Settings file is already in the correct location. Copying skipped.');
                                }
                                tl.debug('using settings file: ' + settingsXmlFile);
                            } else {
                                if (mavenOptions) {
                                    mavenOptions = mavenOptions.concat(' ');
                                }
                                mavenOptions = mavenOptions.concat(options[i]);
                            }
                        }
                    }
                    return util.mergeCredentialsIntoSettingsXml(settingsXmlFile, repositories);
                })
                .catch(function (err) {
                    return Q.reject(err);
                });
            } else {
                tl.debug('Built-in Maven feed authentication is disabled');
                return Q.resolve(true);
            }
        })
        .fail(function (err) {
            tl.error(err.message);
            userRunFailed = true; // Record the error and continue
        })
        .then(async function (code) {
            // Setup tool runner to execute Maven goals
            var mvnRun = tl.tool(mvnExec);
            mvnRun.arg('-f');
            mvnRun.arg(mavenPOMFile);
            if (settingsXmlFile) {
                mvnRun.arg('-s');
                mvnRun.arg(settingsXmlFile);
            }
            mvnRun.line(mavenOptions);
            if (isCodeCoverageOpted && mavenGoals.indexOf('clean') == -1) {
                mvnRun.arg('clean');
            }
            mvnRun.arg(mavenGoals);

            // 2. Apply any goals for static code analysis tools selected by the user.
            mvnRun = applySonarQubeArgs(mvnRun, execFileJacoco);

            mvnRun = codeAnalysisOrchestrator.configureBuild(mvnRun);

            // TODO: This needs to be moved to the common package as spotbugs tool
            if (isSpotbugsAnalysisEnabled) {
                await spotbugsTool.AddSpotbugsPlugin(mavenPOMFile);

                mvnRun.arg(`spotbugs:${spotBugsGoal}`);
            }

            // Read Maven standard output
            mvnRun.on('stdout', function (data: Buffer) {
                processMavenOutput(data);
            });

            // 3. Run Maven. Compilation or test errors will cause this to fail.
            return mvnRun.exec(util.getExecOptions());
        })
        .fail(function (err) {
            console.error(err.message);
            userRunFailed = true; // Record the error and continue
        })
        .then(function (code: any) {
            if (code && code['code'] != 0) {
                userRunFailed = true;
            }
            // 4. Attempt to collate and upload static code analysis build summaries and artifacts.

            // The files won't be created if the build failed, and the user should probably fix their build first.
            if (userRunFailed) {
                console.error('Could not retrieve code analysis results - Maven run failed.');
                return;
            }

            // Otherwise, start uploading relevant build summaries.
            tl.debug('Processing code analysis results');
            codeAnalysisOrchestrator.publishCodeAnalysisResults();

            // TODO: This needs to be moved to the common package as spotbugs tool
            if (isSpotbugsAnalysisEnabled && spotBugsGoal === "spotbugs") {
                spotbugsTool.PublishSpotbugsReport(buildOutput)
            }
        })
        .fail(function (err) {
            console.error(err.message);
            // Looks like: "Code analysis failed."
            console.error(tl.loc('codeAnalysis_ToolFailed', 'Code'));
            codeAnalysisFailed = true;
        })
        .then(function () {
            // 5. Always publish test results even if tests fail, causing this task to fail.
            if (publishJUnitResults === true) {
                publishJUnitTestResults(testResultsFiles);
            }
            publishCodeCoverage(isCodeCoverageOpted).then(function() {
                replaceImageSourceToBase64()
                tl.debug('publishCodeCoverage userRunFailed=' + userRunFailed);

                // 6. If #3 or #4 above failed, exit with an error code to mark the entire step as failed.
                if (userRunFailed || codeAnalysisFailed || codeCoverageFailed) {
                    tl.setResult(tl.TaskResult.Failed, "Build failed."); // Set task failure
                }
                else {
                    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded."); // Set task success
                }
            })
            .fail(function (err) {
                tl.setResult(tl.TaskResult.Failed, "Build failed."); // Set task failure
            });

            // Do not force an exit as publishing results is async and it won't have finished
        })
        .fail(function (err) {
            // Set task failure if get exception at step 5
            console.error(err.message);
            tl.setResult(tl.TaskResult.Failed, "Build failed.");
        });
}

function applySonarQubeArgs(mvnsq: ToolRunner | any, execFileJacoco?: string): ToolRunner | any {
    const isJacocoCoverageReportXML: boolean = tl.getBoolInput('isJacocoCoverageReportXML', false);

    if (!tl.getBoolInput('sqAnalysisEnabled', false)) {
        return mvnsq;
    }

    // Apply argument for the JaCoCo tool, if enabled
    if (typeof execFileJacoco != "undefined" && execFileJacoco) {
        mvnsq.arg('-Dsonar.jacoco.reportPaths=' + execFileJacoco);
    }

    if (isJacocoCoverageReportXML && summaryFile) {
        mvnsq.arg(`-Dsonar.coverage.jacoco.xmlReportPaths=${summaryFile}`);
    }

    switch (tl.getInput('sqMavenPluginVersionChoice')) {
        case 'latest':
            mvnsq.arg(`org.sonarsource.scanner.maven:sonar-maven-plugin:RELEASE:sonar`);
            break;
        case 'pom':
            mvnsq.arg(`sonar:sonar`);
            break;
    }

    return mvnsq;
}

// Configure the JVM associated with this run.
function configureMavenOpts() {
    let mavenOptsValue: string = tl.getInput('mavenOpts');

    if (mavenOptsValue) {
        process.env['MAVEN_OPTS'] = mavenOptsValue;
        tl.debug(`MAVEN_OPTS is now set to ${mavenOptsValue}`);
    }
}

// Publishes JUnit test results from files matching the specified pattern.
function publishJUnitTestResults(testResultsFiles: string) {
    var matchingJUnitResultFiles: string[] = undefined;

    // Check for pattern in testResultsFiles
    if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
        tl.debug('Pattern found in testResultsFiles parameter');
        var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
        tl.debug(`buildFolder=${buildFolder}`);
        const allowBrokenSymbolicLinks = tl.getBoolInput('allowBrokenSymbolicLinks');
        tl.debug(`allowBrokenSymbolicLinks=${allowBrokenSymbolicLinks}`);
        matchingJUnitResultFiles = tl.findMatch(buildFolder, testResultsFiles,
            {
                followSymbolicLinks: true,
                followSpecifiedSymbolicLink: true,
                allowBrokenSymbolicLinks,
            },
            { matchBase: true });
    }
    else {
        tl.debug('No pattern found in testResultsFiles parameter');
        matchingJUnitResultFiles = [testResultsFiles];
    }

    if (!matchingJUnitResultFiles || matchingJUnitResultFiles.length == 0) {
        console.log(tl.loc('NoTestResults', testResultsFiles));
        return 0;
    }

    var tp = new tl.TestPublisher("JUnit");
    const testRunTitle = tl.getInput('testRunTitle');
    tp.publish(matchingJUnitResultFiles, 'true', "", "", testRunTitle, 'true', TESTRUN_SYSTEM);
}

function execEnableCodeCoverage(): Q.Promise<string> {
    return enableCodeCoverage()
        .then(function (resp) {
            tl.debug("Enabled code coverage successfully");
            return "CodeCoverage_9064e1d0";
        }).catch(function (err) {
            tl.warning("Failed to enable code coverage: " + err);
            return "";
        });
};

function enableCodeCoverage() : Q.Promise<any> {
    if(!isCodeCoverageOpted){
        return Q.resolve(true);
    }

    var classFilter: string = tl.getInput('classFilter');
    var classFilesDirectories: string = tl.getInput('classFilesDirectories');
    var sourceDirectories: string = tl.getInput('srcDirectories');
    var buildRootPath = path.dirname(mavenPOMFile);
    // appending with small guid to keep it unique. Avoiding full guid to ensure no long path issues.
    var reportPOMFileName = "CCReportPomA4D283EG.xml";
    reportPOMFile = path.join(buildRootPath, reportPOMFileName);
    var targetDirectory = path.join(buildRootPath, "target");

    if (ccTool.toLowerCase() == "jacoco") {
        var reportDirectoryName = "CCReport43F6D5EF";
        var summaryFileName = "jacoco.xml";
    }
    else if (ccTool.toLowerCase() == "cobertura") {
        var reportDirectoryName = path.join("target", "site");
        reportDirectoryName = path.join(reportDirectoryName, "cobertura");
        var summaryFileName = "coverage.xml";
    }

    reportDirectory = path.join(buildRootPath, reportDirectoryName);
    summaryFile = path.join(reportDirectory, summaryFileName);

    if (ccTool.toLowerCase() == "jacoco") {
        execFileJacoco = path.join(reportDirectory, "jacoco.exec");
    }

    // clean any previously generated files.
    tl.rmRF(targetDirectory);
    tl.rmRF(reportDirectory);
    tl.rmRF(reportPOMFile);

    var buildProps: { [key: string]: string } = {};
    buildProps['buildfile'] = mavenPOMFile;
    buildProps['classfilter'] = classFilter;
    buildProps['classfilesdirectories'] = classFilesDirectories;
    buildProps['sourcedirectories'] = sourceDirectories;
    buildProps['summaryfile'] = summaryFile;
    buildProps['reportdirectory'] = reportDirectory;
    buildProps['reportbuildfile'] = reportPOMFile;

    let ccEnabler = new CodeCoverageEnablerFactory().getTool("maven", ccTool.toLowerCase());
    return ccEnabler.enableCodeCoverage(buildProps);
}

function publishCodeCoverage(isCodeCoverageOpted: boolean): Q.Promise<boolean> {
    var defer = Q.defer<boolean>();
    if (isCodeCoverageOpted && ccReportTask) {
        tl.debug("Collecting code coverage reports");

        if (ccTool.toLowerCase() == "jacoco") {
            var mvnReport = tl.tool(mvnExec);
            mvnReport.arg('-f');
            if (tl.exist(reportPOMFile)) {
                // multi module project
                mvnReport.arg(reportPOMFile);
            }
            else {
                mvnReport.arg(mavenPOMFile);
            }
            mvnReport.line(mavenOptions);
            mvnReport.arg("verify");
            mvnReport.arg("-Dmaven.test.skip=true"); // This argument added to skip tests to avoid running them twice. More about this argument: http://maven.apache.org/surefire/maven-surefire-plugin/examples/skipping-tests.html
            mvnReport.exec().then(function (code) {
                publishCCToTfs();
                defer.resolve(true);
            }).fail(function (err) {
                sendCodeCoverageEmptyMsg();
                defer.reject(err);
            });
        }
        else {
            if (ccTool.toLowerCase() == "cobertura") {
                publishCCToTfs();
            }
            defer.resolve(true);
        }
    }
    else {
        defer.resolve(true);
    }

    return defer.promise;
}

function publishCCToTfs() {
    if (tl.exist(summaryFile)) {
        tl.debug("Summary file = " + summaryFile);
        tl.debug("Report directory = " + reportDirectory);
        tl.debug("Publishing code coverage results to TFS");
        var ccPublisher = new tl.CodeCoveragePublisher();
        ccPublisher.publish(ccTool, summaryFile, reportDirectory, "");
    }
    else {
        sendCodeCoverageEmptyMsg();
    }
}

function sendCodeCoverageEmptyMsg() {
    if (failIfCoverageEmptySetting) {
        tl.error(tl.loc('NoCodeCoverage'));
        codeCoverageFailed = true;
    }
    else {
        tl.warning("No code coverage found to publish. There might be a build failure resulting in no code coverage or there might be no tests.");
    }
}

let currentPlugin = '';

function processCurrentPluginFromOutput(data: string) {
    if (data.substring(0, 3) === '<<<') {
        const pluginData = data.substring(4);
        const colonIndex = pluginData.indexOf(":");
        currentPlugin = pluginData.substring(0, colonIndex)

        tl.debug(`Current plugin = ${currentPlugin}`);
    }
}

function processSpotbugsOutput(data: string) {
    const errorsRegExp = /Error size is \d+/;
    const bugsRegExp = /Total bugs: \d+/;

    if (data.match(errorsRegExp)) {
        const errorsCount = +data.split(' ').slice(-1).pop();

        if (errorsCount > 0) {
            tl.command('task.issue', {
                type: 'error'
            }, `Found ${errorsCount} errors by SpotBugs plugin`);
        }
    } else if (data.match(bugsRegExp)) {
        const bugsCount = +data.split(' ').slice(-1).pop();

        if (bugsCount > 0) {
            tl.command('task.issue', {
                type: isFailWhenBugsFoundBySpotbugs ? 'error' : 'warning'
            }, `Found ${bugsCount} bugs by SpotBugs plugin`);
        }
    }
}

// Processes Maven output for errors and warnings and reports them to the build summary.
function processMavenOutput(buffer: Buffer) {
    if (buffer == null) {
        return;
    }

    const input = buffer.toString().trim();

    if (input.charAt(0) === '[') {
        const rightBraceIndex = buffer.indexOf(']');
        if (rightBraceIndex > 0) {
            const severity = input.substring(1, rightBraceIndex);
            if (severity === 'INFO') {
                const infoData = input.substring(rightBraceIndex + 1).trim();
                processCurrentPluginFromOutput(infoData);

                if (currentPlugin === 'spotbugs-maven-plugin') {
                    processSpotbugsOutput(infoData);
                }
            } else if (severity === 'ERROR' || severity === 'WARNING') {
                // Try to match Posix output like:
                // /Users/user/agent/_work/4/s/project/src/main/java/com/contoso/billingservice/file.java:[linenumber, columnnumber] error message here
                // or Windows output like:
                // /C:/a/1/s/project/src/main/java/com/contoso/billingservice/file.java:[linenumber, columnnumber] error message here
                // A successful match will return an array of 5 strings - full matched string, file path, line number, column number, error message
                const data = input.substring(rightBraceIndex + 1);
                let match: any;
                let matches: any[] = [];
                const compileErrorsRegex = isWindows ? /\/([^:]+:[^:]+):\[([\d]+),([\d]+)\](.*)/g   //Windows path format - leading slash with drive letter
                    : /([a-zA-Z0-9_ \-\/.]+):\[([0-9]+),([0-9]+)\](.*)/g;  // Posix path format
                while (match = compileErrorsRegex.exec(data)) {
                    matches = matches.concat(match);
                }

                if (matches != null) {
                    let index: number = 0;
                    while (index + 4 < matches.length) {
                        tl.debug('full match = ' + matches[index + 0]);
                        tl.debug('file path = ' + matches[index + 1]);
                        tl.debug('line number = ' + matches[index + 2]);
                        tl.debug('column number = ' + matches[index + 3]);
                        tl.debug('message = ' + matches[index + 4]);

                        // task.issue is only for the xplat agent and doesn't provide the sourcepath link on the summary page.
                        // We should use task.logissue when the xplat agent is retired so this will work on the CoreCLR agent.
                        tl.command('task.issue', {
                            type: severity.toLowerCase(),
                            sourcepath: matches[index + 1],
                            linenumber: matches[index + 2],
                            columnnumber: matches[index + 3]
                        }, matches[index + 0]);

                        index = index + 5;
                    }
                }
            }
        }
    }
}

function execBuildWithRestore() {
    if (restoreOriginalPomXml) {
        tl.checkPath(mavenPOMFile, 'pom.xml');

        const originalPomContents: string = fs.readFileSync(mavenPOMFile, 'utf8');
        execBuild().then(() => fs.writeFileSync(mavenPOMFile, originalPomContents));
    } else {
        execBuild();
    }
}

/**  function read code coverage report as DOM 
 * @param fileName - name of html file with extension
 * @returns - instance of JSOM class from jsdom library
*/
function readCodeCoverageReportAsDom(fileName: string): jsdom.JSDOM {
    const htmlString: string = fs.readFileSync(path.join(reportDirectory, fileName), 'utf-8');
    return new JSDOM(htmlString);
}

/**   function write DOM as html 
 * @param dom - instance of JSOM class from jsdom library 
 * @param fileName - name of html file with extension
*/
function writeDomAsHtml(dom: jsdom.JSDOM, fileName: string): void {
    fs.writeFileSync(path.join(reportDirectory, fileName), dom.serialize())
}

/**   function replace images sources to base64 code in Code Coverage report html */
function replaceImageSourceToBase64(): void {
    const imageSizeLimitKb = 1024;
    try {
        const dom = readCodeCoverageReportAsDom('index.html');
        const images: HTMLImageElement[] = [...dom.window.document.getElementsByTagName('img')];
        images.forEach(element => {
            const pathToImg: string = path.join(reportDirectory, element.src)
            if(fs.existsSync(pathToImg) && fs.statSync(pathToImg).size/1024 < imageSizeLimitKb) {
                const fileType = path.extname(pathToImg).slice(1);
                const file: string = fs.readFileSync(path.join(reportDirectory, element.src), 'base64')
                element.src = `data:image/${fileType};base64,` + file;
            }
        });
        writeDomAsHtml(dom, 'index.html')
    } catch (error) {
        tl.warning('Fail to replace images source to base64' + error)
    }
}

execBuildWithRestore();
