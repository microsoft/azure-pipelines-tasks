import Q = require('q');
import assert = require('assert');
import fs = require('fs');
import os = require('os');
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

    it('Selects the Node handlers without the PowerShell handler in both task manifests', (done) => {
        const manifests = [
            JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'task.json'), 'utf8')),
            JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'task.loc.json'), 'utf8'))
        ];

        manifests.forEach(manifest => {
            assert.strictEqual(manifest.execution.PowerShell, undefined, 'PowerShell handler should not be declared');
            assert(manifest.execution.Node10, 'Node10 handler should be declared');
            assert(manifest.execution.Node16, 'Node16 handler should be declared');
            assert(manifest.execution.Node20_1, 'Node20_1 handler should be declared');
        });
        done();
    });

    it('Search simple pattern', (done) => {
        let test = ff.findFiles(path.join(data, '*.log'));
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Finds an explicitly named result file containing glob characters', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-results-'));
        const resultFile = path.join(tempDir, 'results[1].xml');
        fs.writeFileSync(resultFile, '');

        try {
            assert.deepStrictEqual(ff.findFiles(resultFile), [posixFormat(resultFile)]);
        } finally {
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Matches wildcard result files under a working directory containing glob characters', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-[1]-'));
        const resultFile = path.join(tempDir, 'test-result.xml');
        fs.writeFileSync(resultFile, '');

        try {
            assert.deepStrictEqual(ff.findFiles('**/test-*.xml', false, tempDir), [posixFormat(resultFile)]);
        } finally {
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Matches result files case-insensitively on Windows', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-case-'));
        const resultFile = path.join(tempDir, 'test-result.xml');
        fs.writeFileSync(resultFile, '');

        try {
            const result = ff.findFiles('TEST-*.xml', false, tempDir);
            if (process.platform === 'win32') {
                assert.deepStrictEqual(result, [posixFormat(resultFile)]);
            } else {
                assert.deepStrictEqual(result, []);
            }
        } finally {
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Includes symbolic links to result files', function () {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-symlink-'));
        const resultFile = path.join(tempDir, 'test-result.xml');
        const linkedResultFile = path.join(tempDir, 'linked-result.xml');
        fs.writeFileSync(resultFile, '');

        try {
            try {
                fs.symlinkSync(resultFile, linkedResultFile, 'file');
            } catch (err) {
                if (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOSYS' || err.code === 'ENOTSUP') {
                    this.skip();
                    return;
                }
                throw err;
            }

            const result = ff.findFiles('*.xml', false, tempDir);
            assert(result.indexOf(posixFormat(linkedResultFile)) >= 0, 'linked result file should be included');
        } finally {
            if (fs.existsSync(linkedResultFile)) {
                fs.unlinkSync(linkedResultFile);
            }
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
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

    it('Escapes user-provided values in the results.publish logging command', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0EscapesLoggingCommandProperties.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(!/^##vso\[task\.setvariable/m.test(tr.stdout), 'user input should not inject logging commands: ' + tr.stdout);
        assert(tr.stdout.indexOf('platform=x64%0A##vso[task.setvariable variable=PTR_INJECTED%3B%5Dtrue%0A;') >= 0, 'platform should be escaped: ' + tr.stdout);
        assert(tr.stdout.indexOf('runTitle=Title%0A##vso[task.setvariable variable=PTR_INJECTED%3B%5Dtrue%0A;') >= 0, 'runTitle should be escaped: ' + tr.stdout);
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
