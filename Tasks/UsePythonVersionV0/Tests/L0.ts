import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';

import { MockTestRunner } from 'vsts-task-lib/mock-test';

function didSetVariable(testRunner: MockTestRunner, variableName: string, variableValue: string): boolean {
    return testRunner.stdOutContained(`##vso[task.setvariable variable=${variableName};issecret=false;]${variableValue}`);
}

describe('UsePythonVersion L0 Suite', function () {
    describe('usepythonversion.ts', function () {
        require('./L0_usepythonversion');
    });

    it('succeeds when version is found', function () {
        const testFile = path.join(__dirname, 'L0SucceedsWhenVersionIsFound.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        assert(didSetVariable(testRunner, 'pythonLocation', path.join('/', 'Python', '3.6.4', 'x64')));
        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
    });

    it('fails when version is not found', function () {
        const testFile = path.join(__dirname, 'L0FailsWhenVersionIsMissing.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        const errorMessage = [
            'loc_mock_VersionNotFound 3.x',
            'loc_mock_ListAvailableVersions',
            '2.6.0 (x86)',
            '2.7.13 (x86)',
            '2.6.0 (x64)',
            '2.7.13 (x64)'
        ].join(EOL);

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
});
