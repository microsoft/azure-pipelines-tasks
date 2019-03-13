import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';

import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

function didSetVariable(testRunner: MockTestRunner, variableName: string, variableValue: string): boolean {
    return testRunner.stdOutContained(`##vso[task.setvariable variable=${variableName};issecret=false;]${variableValue}`);
}

function didPrependPath(testRunner: MockTestRunner, toolPath: string): boolean {
    return testRunner.stdOutContained(`##vso[task.prependpath]${toolPath}`);
}

describe('UsePythonVersion L0 Suite', function () {
    describe('usepythonversion.ts', function () {
        require('./L0_usepythonversion');
    });

    describe('versionspec.ts', function () {
        require('./L0_versionspec');
    });

    it('succeeds when version is found', function () {
        const testFile = path.join(__dirname, 'L0SucceedsWhenVersionIsFound.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        const pythonDir = path.join('/', 'Python', '3.6.4', 'x64');
        const pythonBinDir = os.platform() === 'win32'
            ? path.join(pythonDir, 'Scripts')
            : path.join(pythonDir, 'bin');

        assert(didSetVariable(testRunner, 'pythonLocation', pythonDir));
        assert(didPrependPath(testRunner, pythonDir));
        assert(didPrependPath(testRunner, pythonBinDir));
        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
    });

    it('fails when version is not found', function () {
        const testFile = path.join(__dirname, 'L0FailsWhenVersionIsMissing.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        const errorMessage = [
            'loc_mock_VersionNotFound 3.x x64',
            'loc_mock_ListAvailableVersions $(Agent.ToolsDirectory)',
            '2.6.0 (x86)',
            '2.7.13 (x86)',
            '2.6.0 (x64)',
            '2.7.13 (x64)',
            'loc_mock_ToolNotFoundMicrosoftHosted Python https://aka.ms/hosted-agent-software',
            'loc_mock_ToolNotFoundSelfHosted Python https://go.microsoft.com/fwlink/?linkid=871498',
        ].join(os.EOL);

        assert(testRunner.createdErrorIssue(errorMessage));
        assert(testRunner.failed, 'task should have failed');
    });

    it('selects architecture passed as input', function () {
        const testFile = path.join(__dirname, 'L0SelectsArchitecture.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        assert(didSetVariable(testRunner, 'pythonLocation', 'x86ToolPath'));
        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
    });

    it('finds PyPy', function () {
        const testFile = path.join(__dirname, 'L0PyPy.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        const pypyDir = path.join('/', 'pypy');
        const pypyBinDir = os.platform() === 'win32'
            ? path.join(pypyDir, 'Scripts')
            : path.join(pypyDir, 'bin');

        assert(didSetVariable(testRunner, 'pythonLocation', pypyBinDir));
        assert(didPrependPath(testRunner, pypyBinDir));
        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
    });
});
