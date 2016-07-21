/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import mockHelper = require('../../lib/mockHelper');
import path = require('path');
import fs = require('fs');
import url = require('url');
import {Url} from 'url';
import nock = require('nock');

import {ToolRunner} from 'vsts-task-lib/toolrunner';
import tr = require('../../lib/vsts-task-lib/toolRunner');

import tl = require('../../../Tasks/Maven/testlib/tasklib-wrapper');
import tlMock = require('../../../Tasks/Maven/testlib/testlib-main');
import sqCommon = require('../../../Tasks/Maven/sonarqube-common/sonarqube-common');
import pmd = require('../../../Tasks/Maven/CodeAnalysis/mavenpmd');
import ca = require('../../../Tasks/Maven/CodeAnalysis/mavencodeanalysis');
import ar = require('../../../Tasks/Maven/CodeAnalysis/analysisresult');

import Q = require('q');
import http = require('http');
import {IncomingMessage} from 'http';

function setResponseFile(name:string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

// Sets up a Maven TaskRunner instance with all of the required default settings
function setupDefaultMavenTaskRunner(): trm.TaskRunner {
    var taskRunner = new trm.TaskRunner('Maven', true, true);
    // default required settings
    taskRunner.setInput('mavenVersionSelection', 'Path');
    taskRunner.setInput('mavenPath', '/home/bin/maven') // Make that checkPath returns true for this filename in the response file
    taskRunner.setInput('goals', 'package');
    taskRunner.setInput('javaHomeSelection', 'JDKVersion');
    taskRunner.setInput('jdkVersion', 'default');
    taskRunner.setInput('jdkArchitecture', 'x86');
    taskRunner.setInput('testResultsFiles', '**/TEST-*.xml');
    taskRunner.setInput('sqAnalysisEnabled', 'false');
    taskRunner.setInput('mavenPOMFile', 'pom.xml');

    // TaskRunner system is incompatible with HTTP/HTTPS mocking due to the use of seperate processes
    taskRunner.setInput('sqAnalysisWaitForAnalysis', 'false');

    return taskRunner;
}

// Recursively lists all files within the target folder, giving their full paths.
function listFolderContents(folder): string[] {
    var result: string[] = [];
    var filesInFolder = fs.readdirSync(folder);

    filesInFolder.forEach(function (fileInFolder) {
        result.push(path.join(folder, fileInFolder));
        if (fs.statSync(path.join(folder, fileInFolder)).isDirectory()) {
            result = result.concat(listFolderContents(path.join(folder, fileInFolder)));
        }
    });

    return result;
}

// Adds mock exist, checkPath, rmRF and mkdirP responses for given file paths.
// Takes an object to add to and an array of file paths for which responses should be added.
// Modifies and returns the argument object.
function setupMockResponsesForPaths(responseObject:any, paths:string[]) { // Can't use rest arguments here (gulp-mocha complains)

    // Create empty objects for responses only if they did not already exist (avoid overwriting existing responses)
    responseObject.exist = responseObject.exist || {};
    responseObject.checkPath = responseObject.checkPath || {};
    responseObject.rmRF = responseObject.rmRF || {};
    responseObject.mkdirP = responseObject.mkdirP || {};

    var rmRFSuccessObj = {
        success: true,
        message: "foo bar"
    };

    paths.forEach((path) => {
        responseObject.exist[path] = true;
        responseObject.checkPath[path] = true;
        responseObject.rmRF[path] = rmRFSuccessObj;
        responseObject.mkdirP[path] = true;
    });

    return responseObject;
}

// Create temp dirs for mavencodeanalysis tests to save into
function createTempDirsForCodeAnalysisTests(): void {
    var testTempDir: string = path.join(__dirname, '_temp');
    var caTempDir: string = path.join(testTempDir, '.codeAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    if (!fs.existsSync(caTempDir)) {
        fs.mkdirSync(caTempDir);
    }
}

// Create temp dirs for mavencodeanalysis tests to save into
function createTempDirsForSonarQubeTests(): void {
    var testTempDir: string = path.join(__dirname, '_temp');
    var sqTempDir: string = path.join(testTempDir, '.sqAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}

function assertCodeAnalysisBuildSummaryContains(stagingDir: string, expectedString: string): void {
    assertBuildSummaryContains(fs.readFileSync(path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md'), 'utf-8'), expectedString);
}

function assertSonarQubeBuildSummaryContains(stagingDir: string, expectedString: string): void {
    assertBuildSummaryContains(fs.readFileSync(path.join(stagingDir, '.sqAnalysis', 'SonarQubeBuildSummary.md'), 'utf-8'), expectedString);
}

// Asserts the existence of a given line in the build summary file that is uploaded to the server.
function assertBuildSummaryContains(buildSummaryString:string, expectedLine:string):void {
    assert(buildSummaryString.indexOf(expectedLine) > -1, `Expected build summary to contain: ${expectedLine}
     Actual: ${buildSummaryString}`);
}

function assertToolRunnerContainsArg(toolRunner:ToolRunner, expectedArg:string) {
    return toolRunner.args.indexOf(expectedArg) > -1;
}

function assertToolRunnerHasArgLength(toolRunner:ToolRunner, expectedNumArgs:number) {
    return toolRunner.args.length == expectedNumArgs;
}

// Creates a new response json file based on an initial one and some env variables 
function setResponseAndBuildVars(initialResponseFile:string, finalResponseFile:string, envVars:Array<[string,string]>) {

    var responseJsonFilePath:string = path.join(__dirname, initialResponseFile);
    var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
    responseJsonContent.getVariable = responseJsonContent.getVariable || {};
    for (var envVar of envVars) {
        responseJsonContent.getVariable[envVar[0]] = envVar[1];
    }

    var newResponseFilePath:string = path.join(__dirname, finalResponseFile);
    fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
    setResponseFile(path.basename(newResponseFilePath));
}

// Invokes a REST endpoint at the SonarQube server.
function callSonarQubeRestEndpoint(path:string):Q.Promise<any> {
    var defer = Q.defer<any>();

    var options:any = createSonarQubeHttpRequestOptions(path);

    var responseBody:string = '';
    var request = http.request(options, (response:IncomingMessage) => {

        response.on('data', function (body) {
            responseBody += body;
        });

        response.on('end', function () {
            var result:string = responseBody;
            if (!(response.statusCode == 200)) {
                defer.reject(result);
            } else {
                defer.resolve(result);
            }
        });
    });

    request.on('error', (error) => {
        defer.reject(error);
    });

    tl.debug('Sending request to: ' + path);
    request.end();
    return defer.promise;
}

// Constructs the options object used by the https.request() method. Takes the host-relative path i.e. '/' as an argument.
function createSonarQubeHttpRequestOptions(path?:string):Object {

    var options = {
        method: 'GET',
        protocol: 'http',
        host: 'sonarqubeserver',
        port: 9000,
        path: path || '/',
        headers: {}
    };

    return options;
}

// Mocks web requests to the given host and path, returning the result with an optional return code (i.e. 200, 404)
// The result field may be a string or a JSON-encoded object representation of the same.
function mockAndReturn(host:Url, path:string, result:string|Object, returnCode?:number) {
    console.log(`Registering mock for host ${host.href} and path ${path}`);
    return nock(host.href)
        .persist()
        .get(path)
        .reply(returnCode || 200, result);
}

describe('Maven Suite', function () {
    this.timeout(20000);

    before((done) => {
        tl.enableTesting();
        done();
    });

    after(function() {

    });

    afterEach((done) => {
        nock.cleanAll();
        done();
    })

    it('run maven with all default inputs and M2_HOME not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                done(err);
            });
    })

    it('run maven with all default inputs and M2_HOME set', (done) => {
        setResponseFile('responseM2_HOME.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        process.env['M2_HOME'] = '/anotherHome/bin/maven/bin/mvn';

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with missing mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        //tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: mavenVersionSelection') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with INVALID mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'garbage');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath valid)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath missing)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: mavenPath') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath INVALID)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven333')
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found mavenPath:') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenSetM2Home set to garbage', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenSetM2Home', 'garbage');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenSetM2Home set to true', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenSetM2Home', 'true');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('set M2_HOME=/home/bin/maven2') >= 0, 'M2_HOME not set');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with options set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p "/t:i o" /n /s');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t:i o /n /s package'), 'it should have run mvn -f pom.xml /o /p /t:i o /n /s package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with goals not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        //tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: goals') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with tasks set to multiple', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with missing publishJUnitResults input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with publishJUnitResults set to "garbage"', (done) => {
        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven and publish tests', (done) => {
        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('##vso[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=/user/build/fun/test-123.xml;]') >= 0, 'test files not published');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing testResultsFiles input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: testResultsFiles') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing javaHomeSelection input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        //tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: javaHomeSelection') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with jdkVersion set to 1.8', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.8');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('set JAVA_HOME=/user/local/bin/Java8') >= 0, 'JAVA_HOME not set correctly');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with jdkVersion set to 1.5', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.5');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('Failed to find specified JDK version') >= 0, 'JAVA_HOME set?');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with Valid inputs but it fails', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'FAIL package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml FAIL package'), 'it should have run mvn -f pom.xml FAIL package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('FAILED') >= 0, 'It should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven including SonarQube analysis', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') > 0,
                    'should have uploaded a SonarQube Analysis Report build summary');
                assertSonarQubeBuildSummaryContains(testStgDir,
                    '[Detailed SonarQube report >](http://sonarqubeserver:9000/dashboard/index/test "test Dashboard")');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    })

    it('run maven including SonarQube analysis (with db details)', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'false');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('sqDbDetailsRequired', 'true');
        tr.setInput('sqDbUrl', 'dbURL');
        tr.setInput('sqDbUsername', 'dbUser');
        tr.setInput('sqDbPassword', 'dbPass');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jdbc.url=dbURL -Dsonar.jdbc.username=dbUser -Dsonar.jdbc.password=dbPass sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') > 0,
                    'should have uploaded a SonarQube Analysis Report build summary');
                assertSonarQubeBuildSummaryContains(testStgDir,
                    '[Detailed SonarQube report >](http://sonarqubeserver:9000/dashboard/index/test "test Dashboard")');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    })


    it('Maven with SonarQube - Fails when report-task.txt is invalid', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-invalid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should not have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 1,
                    'should not have uploaded a SonarQube Analysis Report build summary');
                assert(tr.stderr.indexOf('Invalid or missing task report. Check SonarQube finished successfully.') > -1,
                    'should have output an error about a failure to find the task report');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with SonarQube - Fails when report-task.txt is missing', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = __dirname;
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should not have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 1,
                    'should not have uploaded a SonarQube Analysis Report build summary');

                assert(tr.stderr.indexOf('Invalid or missing task report. Check SonarQube finished successfully.') > -1,
                    'should have output an error about a failure to find the task report');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with SonarQube - Does not fail if report-task.txt is missing during a PR build', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = __dirname;
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran(
                    '/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json sonar:sonar'
                    ), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length < 1, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') > 0,
                    'should have uploaded a SonarQube Analysis Report build summary');
                assertSonarQubeBuildSummaryContains(testStgDir,
                    'Detailed SonarQube reports are not available for pull request builds.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    });


    it('maven calls enable code coverage and publish code coverage when jacoco is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml clean package'), 'it should have run mvn -f pom.xml clean package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and publish code coverage and sonar analysis when jacoco and sonar analysis is selected', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'responseCodeCoverage.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml clean package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jacoco.reportPath=CCReport43F6D5EF\/jacoco.exec sonar:sonar'), 'it should have run SQ analysis');
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and not publish code coverage when jacoco is selected and report generation failed', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml clean package'), 'it should have run mvn -f pom.xml clean package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and publish code coverage when cobertura is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml clean package'), 'it should have run mvn -f pom.xml clean package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and publish code coverage and sonar analysis when cobertura is selected and sonar analysis enabled', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'responseCodeCoverage.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml clean package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and not publish code coverage when cobertura is selected and report generation failed', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml clean package'), 'it should have run mvn -f pom.xml clean package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('Maven build with publish test results', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'None');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0)
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('Maven with PMD - Executes PMD and uploads results when there is only a root module', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');
        var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis'); // overall directory for all tools
        var pmdStgDir: string = path.join(codeAnalysisStgDir, '.pmd'); // PMD subdir is used for artifact staging
        var moduleStgDir: string = path.join(pmdStgDir, 'root'); // one and only one module in test data, called root

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package pmd:pmd'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=root;artifactname=') > -1,
                    'should have uploaded PMD build artifacts');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 3 violations in 2 files.');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with PMD - Executes PMD and uploads results when multiple modules are present', function (done) {
        // In the test data:
        // /: pom.xml, no target/
        // /util/: pom.xml, target/, has violations
        // /ignored/: pom.xml, no target/
        // /backend/: pom.xml, target/, has no violations - not expecting uploads from this module
        // /leveltwo/app/: pom.xml, target/, has violations
        // /leveltwo/static/: no pom.xml, target/

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'multimodule');
        var testStgDir: string = path.join(__dirname, '_temp');
        var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis'); // overall directory for all tools
        var pmdStgDir: string = path.join(codeAnalysisStgDir, '.pmd'); // PMD subdir is used for artifact staging

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {

                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package pmd:pmd'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                // assert artifacts not uploaded
                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=app;artifactname=') > -1,
                    'should have uploaded PMD build artifacts for the "app" module');
                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=util;artifactname=') > -1,
                    'should have uploaded PMD build artifacts for the "util" module');
                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=backend;artifactname=') < 0,
                    'should not have uploaded PMD build artifacts for the "backend" module');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 6 violations in 4 files.');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with PMD - Skips PMD goals if PMD is not enabled', function (done) {
        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testStgDir: string = path.join(__dirname, '_temp');
        var testSrcDir: string = path.join(__dirname, 'data');

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'false');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package'),
                    'should have run maven without PMD arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') < 1,
                    'should not have uploaded a Code Analysis Report build summary');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with PMD - Should succeed even if XML output cannot be found', function (done) {
        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testStgDir: string = path.join(__dirname, '_temp');
        var testSrcDir: string = path.join(__dirname, 'data');

        // Add test file(s) to the response file so that tl.exist() and tl.checkPath() calls return correctly
        var srcResponseFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(srcResponseFilePath, 'utf-8'));

        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        // Set the newly-changed response file
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.succeeded, 'task should not have failed');
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package pmd:pmd'),
                    'should have run maven with the correct arguments');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('during PR builds SonarQube analysis runs in issues mode', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json sonar:sonar'), 'it should have run SQ analysis in issues mode');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    })

    /* Unit tests - SonarQube common code */

    it('Applies correct SonarQube connection arguments', (done) => {
        // Arrange
        var toolRunner:ToolRunner = new ToolRunner('');
        var serverUrl:Url = url.parse('http://sonarqubeserver:9000'); // should match getVariable('ENDPOINT_URL_ID1) in response.json
        tlMock.setInput('sqConnectedServiceName', 'ID1');
        tlMock.setVariable('ENDPOINT_URL_ID1', serverUrl.href);
        tlMock.setVariable('ENDPOINT_AUTH_ID1', '{"scheme":"UsernamePassword","parameters":{"username":"username","password":"password"}}');

        // Act
        toolRunner = sqCommon.applySonarQubeConnectionParams(toolRunner);

        // Assert
        assertToolRunnerHasArgLength(toolRunner, 3);
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.host.url=http://sonarqubeserver:9000');
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.login=username');
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.password=password');
        done();
    })

    it('Applies correct SonarQube connection arguments (with db details)', (done) => {
        // Arrange
        var toolRunner:ToolRunner = new ToolRunner('');
        var serverUrl:Url = url.parse('http://sonarqubeserver:9000'); // should match getVariable('ENDPOINT_URL_ID1) in response.json
        tlMock.setInput('sqConnectedServiceName', 'ID1');
        tlMock.setVariable('ENDPOINT_URL_ID1', serverUrl.href);
        tlMock.setVariable('ENDPOINT_AUTH_ID1', '{"scheme":"UsernamePassword","parameters":{"username":"username","password":"password"}}');

        tlMock.setInput('sqDbDetailsRequired', 'true');
        tlMock.setInput('sqDbUrl', 'dbURL');
        tlMock.setInput('sqDbUsername', 'dbUser');
        tlMock.setInput('sqDbPassword', 'dbPass');

        // Act
        toolRunner = sqCommon.applySonarQubeConnectionParams(toolRunner);

        // Assert
        assertToolRunnerHasArgLength(toolRunner, 6);
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.host.url=http://sonarqubeserver:9000');
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.login=username');
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.password=password');
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.jdbc.url=dbURL');
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.jdbc.username=dbUser');
        assertToolRunnerContainsArg(toolRunner, '-Dsonar.jdbc.password=dbPass');
        done();
    })

    it('Maven with SQ - Creates and uploads a correct SonarQube build summary on quality gate pass', () => {
        tlMock.setInput('sqAnalysisEnabled', 'true');

        var serverUrl:Url = url.parse('http://sonarqubeserver:9000'); // should match getVariable('ENDPOINT_URL_ID1) in response.json
        tlMock.setInput('sqConnectedServiceName', 'ID1');
        tlMock.setVariable('ENDPOINT_URL_ID1', serverUrl.href);
        tlMock.setVariable('ENDPOINT_AUTH_ID1', '{"scheme":"UsernamePassword","parameters":{"username":"username","password":"password"}}');
        tlMock.setInput('sqAnalysisWaitForAnalysis', 'true');


        var testSrcDir:string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir:string = path.join(__dirname, '_temp');
        // Set mocked build variables
        tlMock.setVariable('build.sourcesDirectory', testSrcDir);
        tlMock.setVariable('build.artifactStagingDirectory', testStgDir);

        // The task details
        var taskResponse:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'task_details.json'), 'utf-8'));
        taskResponse.task.status = 'SUCCESS'; // task is a success
        mockAndReturn(serverUrl, `/api/ce/task?id=${'asdfghjklqwertyuiopz'}`, taskResponse); // Task ID should match report-task.txt

        // The analysis details
        var analysisResponse:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'analysis_details.json'), 'utf-8'));
        analysisResponse.projectStatus.status = 'OK'; // task is a success
        mockAndReturn(serverUrl, `/api/qualitygates/project_status?analysisId=${'12345'}`, analysisResponse); // Analysis ID should match task-details.json

        // Act
        return sqCommon.uploadSonarQubeBuildSummaryIfEnabled(path.join(__dirname, 'data', 'taskreport-valid', 'target', 'sonar'))
            .then(() => {
                //Assert
                var buildSummaryString:string = fs.readFileSync(path.join(testStgDir, '.sqAnalysis', 'SonarQubeBuildSummary.md'), 'utf-8');
                assertBuildSummaryContains(buildSummaryString, 'Quality Gate');
                assertBuildSummaryContains(buildSummaryString, 'Passed');
                assertBuildSummaryContains(buildSummaryString, serverUrl.href);
            });

    });

    it('Maven with SQ - Creates and uploads a correct SonarQube build summary on quality gate failure', () => {
        tlMock.setInput('sqAnalysisEnabled', 'true');

        var serverUrl:Url = url.parse('http://sonarqubeserver:9000'); // should match getVariable('ENDPOINT_URL_ID1) in response.json
        tlMock.setInput('sqConnectedServiceName', 'ID1');
        tlMock.setVariable('ENDPOINT_URL_ID1', serverUrl.href);
        tlMock.setVariable('ENDPOINT_AUTH_ID1', '{"scheme":"UsernamePassword","parameters":{"username":"username","password":"password"}}');
        tlMock.setInput('sqAnalysisWaitForAnalysis', 'true');


        var testSrcDir:string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir:string = path.join(__dirname, '_temp');
        // Set mocked build variables
        tlMock.setVariable('build.sourcesDirectory', testSrcDir);
        tlMock.setVariable('build.artifactStagingDirectory', testStgDir);

        // The task details
        var taskResponse:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'task_details.json'), 'utf-8'));
        taskResponse.task.status = 'SUCCESS'; // task is a success
        mockAndReturn(serverUrl, `/api/ce/task?id=${'asdfghjklqwertyuiopz'}`, taskResponse); // Task ID should match report-task.txt

        // The analysis details
        var analysisResponse:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'analysis_details.json'), 'utf-8'));
        analysisResponse.projectStatus.status = 'ERROR'; // task is a success
        mockAndReturn(serverUrl, `/api/qualitygates/project_status?analysisId=${'12345'}`, analysisResponse); // Analysis ID should match task-details.json

        // Act
        return sqCommon.uploadSonarQubeBuildSummaryIfEnabled(path.join(__dirname, 'data', 'taskreport-valid', 'target', 'sonar'))
            .then(() => {
                //Assert
                var buildSummaryString:string = fs.readFileSync(path.join(testStgDir, '.sqAnalysis', 'SonarQubeBuildSummary.md'), 'utf-8');
                assertBuildSummaryContains(buildSummaryString, 'Quality Gate');
                assertBuildSummaryContains(buildSummaryString, 'Failed');
                assertBuildSummaryContains(buildSummaryString, serverUrl.href);
            });
    })

    it('Maven with SQ - Throws an error if the response from the server is an error', () => {
        tlMock.setInput('sqAnalysisEnabled', 'true');

        var serverUrl:Url = url.parse('http://sonarqubeserver:9000'); // should match getVariable('ENDPOINT_URL_ID1) in response.json
        tlMock.setInput('sqConnectedServiceName', 'ID1');
        tlMock.setVariable('ENDPOINT_URL_ID1', serverUrl.href);
        tlMock.setVariable('ENDPOINT_AUTH_ID1', '{"scheme":"UsernamePassword","parameters":{"username":"username","password":"password"}}');
        tlMock.setInput('sqAnalysisWaitForAnalysis', 'true');


        var testSrcDir:string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir:string = path.join(__dirname, '_temp');
        // Set mocked build variables
        tlMock.setVariable('build.sourcesDirectory', testSrcDir);
        tlMock.setVariable('build.artifactStagingDirectory', testStgDir);

        // The task details
        mockAndReturn(serverUrl, `/api/ce/task?id=${'asdfghjklqwertyuiopz'}`, '', 500); // Error 500 is a general server problem

        // The analysis details
        mockAndReturn(serverUrl, `/api/qualitygates/project_status?analysisId=${'12345'}`, '', 500); // Error 500 is a general server problem

        // Act
        return sqCommon.uploadSonarQubeBuildSummaryIfEnabled(path.join(__dirname, 'data', 'taskreport-valid', 'target', 'sonar'))
            .then(() => {
                // Expecting a failure
                assert.fail('success', 'failure', 'Should not have exited successfully');
            }, (err) => {
                //Assert
                console.log(err);
                assert(err.toUpperCase().indexOf('500') > -1, 'Should have thrown an error due to a non-200 response code');
            });
    })

    it('Maven with SQ - Throws an error if the response from the server is invalid (empty body)', () => {
        tlMock.setInput('sqAnalysisEnabled', 'true');

        var serverUrl:Url = url.parse('http://sonarqubeserver:9000'); // should match getVariable('ENDPOINT_URL_ID1) in response.json
        tlMock.setInput('sqConnectedServiceName', 'ID1');
        tlMock.setVariable('ENDPOINT_URL_ID1', serverUrl.href);
        tlMock.setVariable('ENDPOINT_AUTH_ID1', '{"scheme":"UsernamePassword","parameters":{"username":"username","password":"password"}}');
        tlMock.setInput('sqAnalysisWaitForAnalysis', 'true');

        var testSrcDir:string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir:string = path.join(__dirname, '_temp');
        // Set mocked build variables
        tlMock.setVariable('build.sourcesDirectory', testSrcDir);
        tlMock.setVariable('build.artifactStagingDirectory', testStgDir);

        // The task details
        mockAndReturn(serverUrl, `/api/ce/task?id=${'asdfghjklqwertyuiopz'}`, ''); // Empty response
        // The analysis details
        mockAndReturn(serverUrl, `/api/qualitygates/project_status?analysisId=${'12345'}`, ''); // Empty response

        // Act
        return sqCommon.uploadSonarQubeBuildSummaryIfEnabled(path.join(__dirname, 'data', 'taskreport-valid', 'target', 'sonar'))
            .then(() => {
                // Expecting a failure
                assert.fail('success', 'failure', 'Should not have exited successfully');
            }, (err) => {
                //Assert
                console.log(err);
                assert(err.message.indexOf('sqCommon_InvalidResponseFromServer') > -1, 'Should have thrown an error due to an invalid response');
            });
    });

    it('Maven with SQ - Throws an error if the response from the server is invalid (non-JSON response)', () => {
        tlMock.setInput('sqAnalysisEnabled', 'true');

        var serverUrl:Url = url.parse('http://sonarqubeserver:9000'); // should match getVariable('ENDPOINT_URL_ID1) in response.json
        tlMock.setInput('sqConnectedServiceName', 'ID1');
        tlMock.setVariable('ENDPOINT_URL_ID1', serverUrl.href);
        tlMock.setVariable('ENDPOINT_AUTH_ID1', '{"scheme":"UsernamePassword","parameters":{"username":"username","password":"password"}}');
        tlMock.setInput('sqAnalysisWaitForAnalysis', 'true');

        var testSrcDir:string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir:string = path.join(__dirname, '_temp');
        // Set mocked build variables
        tlMock.setVariable('build.sourcesDirectory', testSrcDir);
        tlMock.setVariable('build.artifactStagingDirectory', testStgDir);

        // The task details
        mockAndReturn(serverUrl, `/api/ce/task?id=${'asdfghjklqwertyuiopz'}`, '<html></html>'); // non-JSON response
        // Analysis details - will not be accessed

        // Act
        return sqCommon.uploadSonarQubeBuildSummaryIfEnabled(path.join(__dirname, 'data', 'taskreport-valid', 'target', 'sonar'))
            .then(() => {
                // Expecting a failure
                assert.fail('success', 'failure', 'Should not have exited successfully');
            }, (err) => {
                //Assert
                console.log(err);
                assert(err.message.indexOf('sqCommon_InvalidResponseFromServer') > -1, 'Should have thrown an error due to an invalid response');
            });
    });
});