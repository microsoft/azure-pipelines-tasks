/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/sonarqube-common.d.ts" />

import assert = require('assert');
import fs = require('fs');
import path = require('path');

import trm = require('../../lib/taskRunner');
import {TaskRunner} from '../../lib/taskRunner';

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

function setDefaultInputs(tr:TaskRunner):TaskRunner {
    tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
    tr.setInput('options', '');
    tr.setInput('tasks', 'build');
    tr.setInput('javaHomeSelection', 'JDKVersion');
    tr.setInput('jdkVersion', 'default');
    tr.setInput('publishJUnitResults', 'true');
    tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    return tr;
}

describe('gradle Suite', function() {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function() {

    });
	
    //TODO: The 'Test Run Title' and 'Code Coverage Tool' fields are 
    //      not used by the NodeJS task currently and so are not tested.


    it('run gradle with all default inputs', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with missing wrapperScript', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src2');
    
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: wrapperScript') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with INVALID wrapperScript', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', '/home/gradlew');
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src2');
    
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found wrapperScript') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with cwd set to valid path', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with cwd set to INVALID path', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src2');
    
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found cwd') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with options set', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew /o /p t i /o /n /s build'), 'it should have run gradlew /o /p t i /o /n /s build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with tasks not set', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: tasks') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with tasks set to multiple', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build test deploy');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew /o /p t i /o /n /s build test deploy'), 'it should have run gradlew /o /p t i /o /n /s build test deploy');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with missing publishJUnitResults input', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with publishJUnitResults set to "garbage"', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('fails if missing testResultsFiles input', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build test deploy');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
    
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
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
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build test deploy');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
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
    
    it('run gradle with jdkVersion set to 1.8', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('jdkVersion', '1.8');
        tr.setInput('jdkArchitecture', 'x86');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('Set JAVA_HOME to /user/local/bin/Java8') >= 0, 'JAVA_HOME not set correctly');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('run gradle with jdkVersion set to 1.5', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('jdkVersion', '1.5');
        tr.setInput('jdkArchitecture', 'x86');
    
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
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
    
    it('run gradle with Valid inputs but it fails', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build FAIL');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew build FAIL'), 'it should have run gradlew build FAIL');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
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
    
    it('Gradle with jacoco selected should call enable and publish code coverage for a single module project.', (done) => {
        setResponseFile('gradleCCSingleModule.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'JaCoCo');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew properties'), 'it should have run gradlew build');
                assert(tr.ran('gradlew build jacocoTestReport'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 2, 'should have only run gradle 2 times');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=build.gradle;summaryfile=summary.xml;reportdirectory=CCReport43F6D5EF;ismultimodule=false;buildtool=Gradle;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\\summary.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0 ||
                    tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/summary.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('Gradle with jacoco selected should call enable and publish code coverage for a multi module project.', (done) => {
        setResponseFile('gradleCCMultiModule.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'JaCoCo');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew properties'), 'it should have run gradlew build');
                assert(tr.ran('gradlew build jacocoRootReport'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 2, 'should have only run gradle 2 times');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=build.gradle;summaryfile=summary.xml;reportdirectory=CCReport43F6D5EF;ismultimodule=true;buildtool=Gradle;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\\summary.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0 ||
                    tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/summary.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('Gradle with cobertura selected should call enable and publish code coverage.', (done) => {
        setResponseFile('gradleCCSingleModule.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'Cobertura');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew properties'), 'it should have run gradlew build');
                assert(tr.ran('gradlew build cobertura'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 2, 'should have only run gradle 2 times');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=build.gradle;summaryfile=coverage.xml;reportdirectory=CCReport43F6D5EF;ismultimodule=false;buildtool=Gradle;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=CCReport43F6D5EF\\coverage.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0 ||
                    tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=CCReport43F6D5EF\/coverage.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('Gradle with jacoco selected and report generation failed should call enable but not publish code coverage.', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'JaCoCo');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew properties'), 'it should have run gradlew build');
                assert(tr.ran('gradlew build jacocoTestReport'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 2, 'should have only run gradle 2 times');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=build.gradle;summaryfile=summary.xml;reportdirectory=CCReport43F6D5EF;ismultimodule=false;buildtool=Gradle;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('Gradle with cobertura selected and report generation failed should call enable but not publish code coverage.', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'Cobertura');
    
        tr.run()
            .then(() => {
                assert(tr.ran('gradlew properties'), 'it should have run gradlew build');
                assert(tr.ran('gradlew build cobertura'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 2, 'should have only run gradle 2 times');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=build.gradle;summaryfile=coverage.xml;reportdirectory=CCReport43F6D5EF;ismultimodule=false;buildtool=Gradle;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    
    it('Gradle build with publish test results.', (done) => {
        setResponseFile('gradleGood.json');
    
        var tr = new TaskRunner('gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'None');
    
        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0)
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Gradle with SonarQube - Should run Gradle with all default inputs when SonarQube analysis disabled', function(done) {
        // Arrange
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('gradle', true, true);
        tr = setDefaultInputs(tr);
        tr.setInput('sqAnalysisEnabled', 'false');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran('gradlew build'), 'it should have run only the default settings');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Gradle with SonarQube - Should run Gradle with SonarQube', function(done) {
        // Arrange

        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('gradle', true, true);
        tr = setDefaultInputs(tr);
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran('gradlew build -I /gradle/sonar.gradle sonarqube -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Gradle with SonarQube - Should run Gradle with SonarQube and apply required parameters for older server versions', function(done) {
        // Arrange
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('gradle', true, true);
        tr = setDefaultInputs(tr);
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('sqDbDetailsRequired', 'true');
        tr.setInput('sqDbUrl', 'jdbc:test:tcp://localhost:8080/sonar');
        tr.setInput('sqDbUsername', 'testDbUsername');
        tr.setInput('sqDbPassword', 'testDbPassword');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran('gradlew build -I /gradle/sonar.gradle sonarqube -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jdbc.url=jdbc:test:tcp://localhost:8080/sonar -Dsonar.jdbc.username=testDbUsername -Dsonar.jdbc.password=testDbPassword'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Gradle with SonarQube - Should run Gradle with SonarQube and override project parameters if specified', function(done) {
        // Arrange

        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('gradle', true, true);
        tr = setDefaultInputs(tr);
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('sqProjectName', 'test_sqProjectName');
        tr.setInput('sqProjectKey', 'test_sqProjectKey');
        tr.setInput('sqProjectVersion', 'test_sqProjectVersion');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran('gradlew build -I /gradle/sonar.gradle sonarqube -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Gradle with SonarQube - Should run Gradle with SonarQube and override project parameters if specified', function(done) {
        // Arrange

        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('gradle', true, true);
        tr = setDefaultInputs(tr);
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('sqProjectName', 'test_sqProjectName');
        tr.setInput('sqProjectKey', 'test_sqProjectKey');
        tr.setInput('sqProjectVersion', 'test_sqProjectVersion');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran('gradlew build -I /gradle/sonar.gradle sonarqube -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

});