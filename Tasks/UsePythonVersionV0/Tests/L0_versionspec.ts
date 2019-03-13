import * as assert from 'assert';

import * as mockery from 'mockery';
import * as mockTask from 'azure-pipelines-task-lib/mock-task';

import * as versionspec from '../versionspec';

/** Reload the unit under test to use mocks that have been registered. */
function reload(): typeof versionspec {
    return require('../versionspec');
}

it('converts Python prerelease versions to the semantic version format', function () {
    mockery.registerMock('azure-pipelines-task-lib/task', mockTask);
    mockery.registerMock('azure-pipelines-tool-lib/tool', {});
    const uut = reload();

    const testCases = [
        {
            versionSpec: '3.x',
            expected: '3.x'
        },
        {
            versionSpec: '3.3.6',
            expected: '3.3.6'
        },
        {
            versionSpec: '3.7.0b2',
            expected: '3.7.0-b2'
        },
        {
            versionSpec: '3.7.0rc',
            expected: '3.7.0-rc'
        },
        {
            versionSpec: '14.22.100a1000',
            expected: '14.22.100-a1000'
        },
        {
            versionSpec: '3.7.0c', // we don't recognize 'c' as a prerelease specifier
            expected: '3.7.0c'
        },
        {
            versionSpec: '3.6.6b2 || >= 3.7.0rc',
            expected: '3.6.6-b2 || >= 3.7.0-rc'
        },
        {
            versionSpec: '3.7rc1', // invalid
            expected: '3.7rc1'
        },
    ];

    for (const tc of testCases) { // Node 5 can't handle destructuring assignment
        const actual = uut.pythonVersionToSemantic(tc.versionSpec);
        assert.strictEqual(actual, tc.expected);
    }
});