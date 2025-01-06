import Q = require('q');
import assert = require('assert');
import path = require('path');
const ff = require(path.join(__dirname, '..', 'find-files-legacy.js'));
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe('PublishTestResultsV1 Find files legacy suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    let data = path.join(__dirname, 'data');

    before((done) => {
        Q.longStackSupport = true;
        done();
    });

    after(function () {
    });

    it('Search simple pattern', (done) => {
        let test = ff.findFiles(path.join(data, '*.log'));
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search multiple patterns', (done) => {
        let test = ff.findFiles([path.join(data, '*.log'), path.join(data, '*.txt')]);
        assert(test.length === 4);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        assert(test[2] === posixFormat(path.join(data, 'a.txt')));
        assert(test[3] === posixFormat(path.join(data, 'b.txt')));
        done();
    });

    it('Search simple pattern with (+:) filter', (done) => {
        let test = ff.findFiles('+:' + path.join(data, '*.log'));
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search multiple patterns with (+:) filter', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '*.log'), '+:' + path.join(data, '*.txt')]);
        assert(test.length === 4);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        assert(test[2] === posixFormat(path.join(data, 'a.txt')));
        assert(test[3] === posixFormat(path.join(data, 'b.txt')));
        done();
    });

    it('Search simple pattern with (+:) filter and (-:) filter', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '*.log'), '-:' + path.join(data, 'a*')]);
        assert(test.length === 1);
        assert(test[0] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search simple pattern with exclude files', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '*'), '-:' + path.join(data, 'a*')]);
        assert(test.length === 3);
        done();
    });

    it('Search recursively with include files', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '**', '*.log')]);
        assert(test.length === 4);
        done();
    });

    it('Search recursively with exclude files', (done) => {
        let test = ff.findFiles([path.join(data, '**', '*'), '-:' + path.join(data, '**', '*.log')]);
        assert(test.length === 6);
        done();
    });

    it('Search recursively with include files and exclude files', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '**', '*.log'), '-:' + path.join(data, '**', 'a*')]);
        assert(test.length === 2);
        done();
    });

    it('Search recursively with exclude files with ignore dir', (done) => {
        let test = ff.findFiles([path.join(data, '**', '*'), '-:' + path.join(data, '**', '*.log')], true);
        assert(test.length === 7);
        done();
    });

    it('Search simple pattern (relative path) starting with ..', (done) => {
        let relativePath = path.relative(process.cwd(), path.join(__dirname, 'data', '*.log'));
        let test = ff.findFiles(relativePath);
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search simple pattern (relative path)', (done) => {
        let relativePath = path.relative(process.cwd(), path.join(__dirname, 'data', '*.log'));
        let test = ff.findFiles(path.join('L0', '..', relativePath));
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search pattern seperated by semi-colon(delimiter)', (done) => {
        let test = ff.findFiles(path.join(data, '*.log') + ";" + path.join(data, '*.txt'));
        assert(test.length === 4);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        assert(test[2] === posixFormat(path.join(data, 'a.txt')));
        assert(test[3] === posixFormat(path.join(data, 'b.txt')));
        done();
    });

    it('Search pattern seperated by semi-colon(delimiter)', (done) => {
        let test = ff.findFiles(path.join(data, 'a*') + ";-:" + path.join(data, 'a.txt'));
        assert(test.length === 1);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        done();
    });

    it('Publish test results with resultFiles filter that does not match with any files', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0FilterDoesNotMatchAnyFile.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 0, 'should exit before running PublishTestResults');
        done();
    });

    it('Publish test results with resultFiles filter that matches with some files', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0FilterMatchesSomeFile.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;resultFiles=/) >= 0, 'should publish test results.');
        done();
    });

    it('Publish test results with resultFiles as file path', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0ResultFilesAsFilePath.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.search(/##vso\[results.publish type=JUnit;resultFiles=/) >= 0, 'should publish test results.');
        done();
    });

    it('Publish test results when test result files input is not provided', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0InputIsNotProvided.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stdout.length > 0, 'should have written to stderr');
        assert(tr.stdout.indexOf('Input required: testResultsFiles') >= 0, 'wrong error message: "' + tr.stdout + '"');
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running PublishTestResults');

        done();
    });

    it('Publish test results when test runner type input is not provided', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0TestRunnerTypeIsNotProvided.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stdout.length > 0, 'should have written to stdout');
        assert(tr.stdout.indexOf('Input required: testRunner') >= 0, 'wrong error message: "' + tr.stdout + '"');
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running PublishTestResults');

        done();
    });

});

function posixFormat(p: string): string {
    let path_regex = /\/\//;
    p = p.replace(/\\/g, '/');
    while (p.match(path_regex)) {
        p = p.replace(path_regex, '/');
    }
    return p;
}
