import Q = require('q');
import assert = require('assert');
import cp = require('child_process');
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

    it('Preserves literal Windows result paths, including missing paths and semicolons', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-results-'));
        const resultFile = path.join(tempDir, 'results[1].xml');
        const missingFile = path.join(tempDir, 'missing;results.xml');
        fs.writeFileSync(resultFile, '');

        try {
            assert.deepStrictEqual(ff.findWindowsFiles(resultFile, tempDir), [resultFile]);
            assert.deepStrictEqual(ff.findWindowsFiles(missingFile, tempDir), [missingFile]);
        } finally {
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Matches Windows wildcard result files under a working directory containing glob characters', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-[1]-'));
        const resultFile = path.join(tempDir, 'test-result.xml');
        fs.writeFileSync(resultFile, '');

        try {
            assert.deepStrictEqual(ff.findWindowsFiles('**/test-*.xml', tempDir), [resultFile]);
        } finally {
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Matches result files case-insensitively on Windows', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-case-'));
        const resultFile = path.join(tempDir, 'test-result.xml');
        fs.writeFileSync(resultFile, '');

        try {
            assert.deepStrictEqual(ff.findWindowsFiles('TEST-*.XML', tempDir), [resultFile]);
        } finally {
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Includes symbolic links to Windows result files', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

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

            const result = ff.findWindowsFiles('*.xml', tempDir);
            assert(result.indexOf(linkedResultFile) >= 0, 'linked result file should be included');
        } finally {
            if (fs.existsSync(linkedResultFile)) {
                fs.unlinkSync(linkedResultFile);
            }
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Uses PowerShell wildcard syntax for Windows result paths', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-[1]-'));
        const semiDir = path.join(tempDir, 'semi;dir');
        const subDir = path.join(tempDir, 'SubDir');
        const nestedDir = path.join(subDir, 'SubSubDir');
        const files = [
            path.join(tempDir, 'report[1]-literal.xml'),
            path.join(tempDir, 'report1-literal.xml'),
            path.join(tempDir, 'report{1..2}-literal.xml'),
            path.join(tempDir, '.dot-result.xml'),
            path.join(tempDir, 'ignore-result.xml'),
            path.join(semiDir, 'test-semi.xml'),
            path.join(subDir, 'match.xml'),
            path.join(nestedDir, 'match.xml')
        ];
        fs.mkdirSync(semiDir);
        fs.mkdirSync(subDir);
        fs.mkdirSync(nestedDir);
        files.forEach(file => fs.writeFileSync(file, ''));

        try {
            assert.deepStrictEqual(ff.findWindowsFiles('report[1]*.xml', tempDir), [files[0]]);
            assert.deepStrictEqual(ff.findWindowsFiles('report{1..2}*.xml', tempDir), [files[2]]);
            assert.deepStrictEqual(ff.findWindowsFiles('semi;;dir\\*.xml', tempDir), [files[5]]);
            assert.deepStrictEqual(ff.findWindowsFiles('Sub**match.xml', tempDir), [files[6], files[7]].sort());
            assert(ff.findWindowsFiles('*.XML', tempDir).indexOf(files[3]) >= 0, 'dot-prefixed file should be included');

            const pattern = '+:' + path.join(tempDir, '**', '*.xml') + ';-:' + path.join(tempDir, '**', 'ignore*.xml');
            assert.deepStrictEqual(ff.findWindowsFiles(pattern, tempDir), files.filter(file => file !== files[4]).sort());
        } finally {
            files.forEach(file => fs.unlinkSync(file));
            fs.rmdirSync(nestedDir);
            fs.rmdirSync(subDir);
            fs.rmdirSync(semiDir);
            fs.rmdirSync(tempDir);
        }
    });

    it('Follows Windows directory junctions when matching recursive result paths', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-junction-'));
        const source = path.join(tempDir, 'source');
        const nested = path.join(source, 'nested');
        const link = path.join(tempDir, 'linked');
        const resultFile = path.join(nested, 'test-result.xml');
        fs.mkdirSync(source);
        fs.mkdirSync(nested);
        fs.writeFileSync(resultFile, '');

        try {
            try {
                fs.symlinkSync(source, link, 'junction');
            } catch (err) {
                if (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOSYS' || err.code === 'ENOTSUP') {
                    this.skip();
                    return;
                }
                throw err;
            }

            const expected = [resultFile, path.join(link, 'nested', 'test-result.xml')].sort();
            assert.deepStrictEqual(ff.findWindowsFiles('**\\test-*.xml', tempDir), expected);
        } finally {
            if (fs.existsSync(link)) {
                fs.rmdirSync(link);
            }
            fs.unlinkSync(resultFile);
            fs.rmdirSync(nested);
            fs.rmdirSync(source);
            fs.rmdirSync(tempDir);
        }
    });

    it('Matches Windows results while skipping broken symbolic links', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptr-broken-link-'));
        const resultFile = path.join(tempDir, 'valid.xml');
        const brokenLink = path.join(tempDir, 'broken.xml');
        const brokenJunction = path.join(tempDir, 'broken-dir.xml');
        let linkCreated = false;
        let junctionCreated = false;
        fs.writeFileSync(resultFile, '');

        try {
            try {
                fs.symlinkSync(path.join(tempDir, 'missing.xml'), brokenLink, 'file');
                linkCreated = true;
                fs.symlinkSync(path.join(tempDir, 'missing-dir'), brokenJunction, 'junction');
                junctionCreated = true;
            } catch (err) {
                if (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOSYS' || err.code === 'ENOTSUP') {
                    this.skip();
                    return;
                }
                throw err;
            }

            assert.deepStrictEqual(ff.findWindowsFiles('valid*.xml', tempDir), [resultFile]);
            assert.deepStrictEqual(ff.findWindowsFiles('broken*.xml', tempDir), []);
        } finally {
            if (junctionCreated) {
                fs.rmdirSync(brokenJunction);
            }
            if (linkCreated) {
                fs.unlinkSync(brokenLink);
            }
            fs.unlinkSync(resultFile);
            fs.rmdirSync(tempDir);
        }
    });

    it('Publishes literal Windows paths safely with the legacy test run system', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }

        const injected = '\n##vso[task.setvariable variable=PTR_INJECTED;]true';
        const resultFile = path.join(data, 'missing;results.xml');
        const env = Object.assign({}, process.env);
        Object.keys(env).filter(key => key.indexOf('INPUT_') === 0).forEach(key => delete env[key]);
        env.INPUT_TESTRUNNER = 'JUnit';
        env.INPUT_TESTRESULTSFILES = resultFile + injected;
        env.SYSTEM_DEFAULTWORKINGDIRECTORY = data;

        const child = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'publishtestresults.js')], {
            env: env,
            encoding: 'utf8'
        });
        assert.strictEqual(child.status, 0, child.stderr);
        assert(!/^##vso\[task\.setvariable/m.test(child.stdout), 'file input should not inject logging commands');
        assert(child.stdout.indexOf('resultFiles=') >= 0 &&
            child.stdout.indexOf('missing%3Bresults.xml%0A##vso[task.setvariable variable=PTR_INJECTED%3B%5Dtrue;') >= 0,
            'literal file input should be escaped');
        assert(child.stdout.indexOf('testRunSystem=VSTS - PTR;') >= 0, 'Windows should retain the PowerShell test run system');
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
        assert(tr.stdout.indexOf('config=Release%0A##vso[task.setvariable variable=PTR_INJECTED%3B%5Dtrue%0A;') >= 0, 'configuration should be escaped: ' + tr.stdout);
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
