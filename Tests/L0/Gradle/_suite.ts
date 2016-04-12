/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import trm = require('../../lib/taskRunner');
import shell = require('shelljs');

var s = require('string');
var gradlew = null;
var buildFile = null;
var mockResponse = 'gradleResponse.json';

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Gradle Build Task Tests', function() {
    this.timeout(10000);

    before((done) => {
        done();
    });

    before(function() {
        var temp = shell.tempdir();
        gradlew = path.join(temp, "gradlew");
        fs.closeSync(fs.openSync(gradlew, 'w'));
        buildFile = path.join(temp, "build.gradle");
        fs.closeSync(fs.openSync(buildFile, 'w'));

        var mockFile = path.join(__dirname, mockResponse);
        var mockData = fs.readFileSync(mockFile, 'utf-8');
        fs.unlinkSync(mockFile);
        fs.writeFileSync(mockFile, s(mockData).replaceAll('${buildfolder}', temp));
    });

    after(function() {
    });

    it('Gradle build without code coverage', (done) => {
        setResponseFile('gradleResponse.json');

        var tr = new trm.TaskRunner('Gradle');
        tr.setInput('wrapperScript', gradlew);
        tr.setInput('buildFile', buildFile);
        tr.setInput('javaHomeSelection', 'someJava');
        tr.setInput('jdkUserInputPath', '/users/jdk');
        tr.setInput('codeCoverageTool', 'None');
        tr.setInput('cwd', '')
        tr.setInput('classFilesDirectories', 'build/classes/main');
        tr.setInput('classFilter', '');
        tr.setInput('tasks', 'build');
        tr.setInput('testResultsFiles', buildFile);

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('vso[codecoverage.enable') == -1);
                assert(tr.stdout.indexOf('vso[codecoverage.publish') == -1);
                done();
            });
    })

    it('Gradle build without Jacoco Coverage', (done) => {
        var gradlew = path.join(shell.tempdir(), "gradlew");
        fs.closeSync(fs.openSync(gradlew, 'w'));
        var buildFile = path.join(shell.tempdir(), "build.gradle");
        fs.closeSync(fs.openSync(buildFile, 'w'));

        setResponseFile('gradleResponse.json');

        var tr = new trm.TaskRunner('Gradle');
        tr.setInput('wrapperScript', gradlew);
        tr.setInput('buildFile', buildFile);
        tr.setInput('javaHomeSelection', 'someJava');
        tr.setInput('jdkUserInputPath', '/users/jdk');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('cwd', '')
        tr.setInput('classFilesDirectories', 'build/classes/main');
        tr.setInput('classFilter', '');
        tr.setInput('tasks', 'build');
        tr.setInput('testResultsFiles', buildFile);

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('gradlew properties') != -1);
                assert(tr.stdout.indexOf('vso[codecoverage.enable') != -1);
                assert(tr.stdout.indexOf('vso[codecoverage.publish') != -1);
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Gradle build without Cobertura Code Coverage', (done) => {
        var gradlew = path.join(shell.tempdir(), "gradlew");
        fs.closeSync(fs.openSync(gradlew, 'w'));
        var buildFile = path.join(shell.tempdir(), "build.gradle");
        fs.closeSync(fs.openSync(buildFile, 'w'));

        setResponseFile('gradleResponse.json');

        var tr = new trm.TaskRunner('Gradle');
        tr.setInput('wrapperScript', gradlew);
        tr.setInput('buildFile', buildFile);
        tr.setInput('javaHomeSelection', 'someJava');
        tr.setInput('jdkUserInputPath', '/users/jdk');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('cwd', '')
        tr.setInput('classFilesDirectories', 'build/classes/main');
        tr.setInput('classFilter', '');
        tr.setInput('tasks', 'build');
        tr.setInput('testResultsFiles', buildFile);

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('gradlew properties') != -1);
                assert(tr.stdout.indexOf('vso[codecoverage.enable') != -1);
                assert(tr.stdout.indexOf('vso[codecoverage.publish') != -1);
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Gradle build With Publish Test Result', (done) => {
        var gradlew = path.join(shell.tempdir(), "gradlew");
        fs.closeSync(fs.openSync(gradlew, 'w'));
        var buildFile = path.join(shell.tempdir(), "build.gradle");
        fs.closeSync(fs.openSync(buildFile, 'w'));

        setResponseFile('gradleResponse.json');

        var tr = new trm.TaskRunner('Gradle');
        tr.setInput('wrapperScript', gradlew);
        tr.setInput('buildFile', buildFile);
        tr.setInput('javaHomeSelection', 'someJava');
        tr.setInput('jdkUserInputPath', '/users/jdk');
        tr.setInput('codeCoverageTool', 'None');
        tr.setInput('cwd', '')
        tr.setInput('classFilesDirectories', 'build/classes/main');
        tr.setInput('classFilter', '');
        tr.setInput('tasks', 'build');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', buildFile);

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
});
