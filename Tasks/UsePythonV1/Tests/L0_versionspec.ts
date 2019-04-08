import * as assert from 'assert';

import * as versionspec from '../version';

it('converts Python prerelease versions to the semantic version format', function () {
    const testCases = [
        {
            version: '3.x',
            expected: '3.x'
        },
        {
            version: '3.3.6',
            expected: '3.3.6'
        },
        {
            version: '3.7.0b2',
            expected: '3.7.0-b2'
        },
        {
            version: '3.7.0rc',
            expected: '3.7.0-rc'
        },
        {
            version: '14.22.100a1000',
            expected: '14.22.100-a1000'
        },
        {
            version: '3.7.0c', // we don't recognize 'c' as a prerelease specifier
            expected: '3.7.0c'
        },
        {
            version: '3.6.6b2 || >= 3.7.0rc',
            expected: '3.6.6-b2 || >= 3.7.0-rc'
        },
        {
            version: '3.7rc1', // invalid
            expected: '3.7rc1'
        },
    ];

    for (const tc of testCases) { // Node 5 can't handle destructuring assignment
        const actual = versionspec.pythonVersionToSemantic(tc.version);
        assert.strictEqual(actual, tc.expected);
    }
});

it('converts -dev syntax to a semantic version', function () {
    const actual = versionspec.desugarDevVersion('3.8-dev');
    assert.strictEqual(actual, '>= 3.8.0-a0');
});