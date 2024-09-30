// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as mt from '../_build/mock-task';
import * as mtm from '../_build/mock-test';
import * as mtr from '../_build/mock-toolrunner';
import * as ma from '../_build/mock-answer';
import * as tl from '../_build/task';

import ncp = require('child_process');
import os = require('os');
import path = require('path');
import semver = require('semver');
import testutil = require('./testutil');

describe('Mock Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });

    // Verify mock-task exports all the exported functions exported by task. If a task-lib function isn't mocked,
    // it's difficult to use in a task with unit tests.
    it('mock-task exports every function in task', (done) => {
        for (let memberName of Object.keys(tl)) {
            const member = tl[memberName];

            if (typeof member === 'function') {
                const mockMember = mt[memberName];
                if (!mockMember || typeof mockMember !== typeof member) {
                    assert.fail(`mock-task missing function exported by task: "${memberName}"`);
                }
            }
        }

        done();
    });

    it('Mocks which and returns path on exists', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "foo": "/bar/baz"
            }
        };

        mt.setAnswers(a);
        assert.equal(mt.which('foo'), '/bar/baz');

        done();
    })
    it('Mock which and returns null on not exist', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "foo": "/bar/baz"
            }
        };

        mt.setAnswers(a);
        assert.equal(mt.which('foo2'), null);

        done();
    })
    it('Mocks exist and returns true on exists', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exist": {
                "/foo/bar": true
            }
        };

        mt.setAnswers(a);
        assert(mt.exist('/foo/bar'));

        done();
    })
    it('Mocks exist and returns false on not exists', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exist": {
                "/foo/bar": true
            }
        };

        mt.setAnswers(a);
        assert.equal(mt.exist('/foo/bar2'), false);

        done();
    })
    it('Mocks CheckPath with Success', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "checkPath": {
                "/foo/bar": true
            }
        };

        mt.setAnswers(a);
        mt.checkPath('/foo/bar', 'bar');

        done();
    })
    it('Mock CheckPath Throws', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "checkPath": {
                "/foo/bar": false
            }
        };

        mt.setAnswers(a);
        assert.throws(() => { mt.checkPath('/foo/bar', 'bar')});

        done();
    })

    it('match not mocked', (done) => {
        let actual: string[] = (mt as any).match(
            [
                '/foo',
                '/bar',
                '/baz',
            ],
            '/ba[rz]');
        assert.deepEqual(actual, [ '/bar', '/baz' ]);

        done();
    })

    it('filter not mocked', (done) => {
        let list = [
            '/foo',
            '/bar',
            '/baz',
        ];
        let actual: string[] = list.filter((mt as any).filter('/ba[rz]'));
        assert.deepEqual(actual, [ '/bar', '/baz' ]);

        done();
    })

    it('Mocks findMatch results', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "findMatch": {
                "/ba[rz]": [
                    "/bar",
                    "/baz",
                ]
            }
        };

        mt.setAnswers(a);
        var matches: string[] = mt.findMatch('/default-root', '/ba[rz]');
        assert.deepEqual(matches, [ '/bar', '/baz' ]);

        done();
    })

    it('Mock loc returns key', (done) => {
        let actual = mt.loc('STR_KEY');
        assert.equal(actual, 'loc_mock_STR_KEY');
        done();
    })

    it('Mock loc returns key and args', (done) => {
        let actual = mt.loc('STR_KEY', false, 2, 'three');
        assert.equal(actual, 'loc_mock_STR_KEY false 2 three');
        done();
    })

    it('Mock returns toolRunner', (done) => {
        let tool = mt.tool('atool');
        assert(tool, "tool should not be null");

        done();
    })

    it('Mock toolRunner returns success code', async () => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exec": {
                "/usr/local/bin/atool --arg foo": {
                    "code": 0,
                    "stdout": "atool output here",
                    "stderr": "atool with this stderr output"
                }
            }
        };

        mt.setAnswers(a);

        let tool: mtr.ToolRunner = mt.tool('/usr/local/bin/atool');
        tool.arg('--arg');
        tool.arg('foo');
        let rc: number = await tool.exec(<mtr.IExecOptions>{});

        assert(tool, "tool should not be null");
        assert(rc == 0, "rc is 0");
    })

    it('Mock toolRunner returns correct output', async () => {
        const expectedStdout = "atool output here" + os.EOL + "abc";
        const expectedStderr = "atool with this stderr output" + os.EOL + "def";
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exec": {
                "/usr/local/bin/atool --arg foo": {
                    "code": 0,
                    "stdout": expectedStdout,
                    "stderr": expectedStderr
                }
            }
        };

        mt.setAnswers(a);

        let tool: mtr.ToolRunner = mt.tool('/usr/local/bin/atool');
        tool.arg('--arg');
        tool.arg('foo');

        let firstStdline = true;
        let firstErrline = true;
        let numStdLineCalls = 0;
        let numStdErrCalls = 0;
        tool.on('stdout', (out) => {
            assert.equal(expectedStdout, out);
        });
        tool.on('stderr', (out) => {
            assert.equal(expectedStderr, out);
        });
        tool.on('stdline', (out) => {
            numStdLineCalls += 1;
            if (firstStdline) {
                assert.equal("atool output here", out);
                firstStdline = false;
            }
            else {
                assert.equal("abc", out);
            }
        });
        tool.on('errline', (out) => {
            numStdErrCalls += 1;
            if (firstErrline) {
                assert.equal("atool with this stderr output", out);
                firstErrline = false;
            }
            else {
                assert.equal("def", out);
            }
        });
        await tool.exec(<mtr.IExecOptions>{});

        assert.equal(numStdLineCalls, 2);
        assert.equal(numStdErrCalls, 2);
    })

    it('Mock toolRunner returns correct output when ending on EOL', async () => {
        const expectedStdout = os.EOL;
        const expectedStderr = os.EOL;
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exec": {
                "/usr/local/bin/atool --arg foo": {
                    "code": 0,
                    "stdout": expectedStdout,
                    "stderr": expectedStderr
                }
            }
        };

        mt.setAnswers(a);

        let tool: mtr.ToolRunner = mt.tool('/usr/local/bin/atool');
        tool.arg('--arg');
        tool.arg('foo');
        let numStdLineCalls = 0;
        let numStdErrCalls = 0;
        tool.on('stdout', (out) => {
            assert.equal(expectedStdout, out);
        });
        tool.on('stderr', (out) => {
            assert.equal(expectedStderr, out);
        });
        tool.on('stdline', (out) => {
            numStdLineCalls += 1;
            assert.equal("", out);
        });
        tool.on('errline', (out) => {
            numStdErrCalls += 1;
            assert.equal("", out);
        });
        await tool.exec(<mtr.IExecOptions>{});

        assert.equal(numStdLineCalls, 1);
        assert.equal(numStdErrCalls, 1);
    })

    it('MockTest handles node 6 tasks correctly', async function () {
        this.timeout(30000);
        const runner = new mtm.MockTestRunner(path.join(__dirname, 'fakeTasks', 'node6task', 'entry.js'));
        await runner.LoadAsync();
        const nodePath = runner.nodePath;
        assert(nodePath, 'node path should have been correctly set');
        const version = ncp.execSync(nodePath + ' -v').toString().trim();
        assert(semver.satisfies(version, '6.x'), 'Downloaded node version should be Node 6 instead of ' + version);
    })

    it('MockTest handles node 10 tasks correctly', async function () {
        this.timeout(30000);
        const runner = new mtm.MockTestRunner();
        await runner.LoadAsync(path.join(__dirname, 'fakeTasks', 'node10task', 'entry.js'));
        const nodePath = runner.nodePath;
        assert(nodePath, 'node path should have been correctly set');
        const version = ncp.execSync(nodePath + ' -v').toString().trim();
        assert(semver.satisfies(version, '10.x'), 'Downloaded node version should be Node 10 instead of ' + version);
    })

    it('MockTest handles node 16 tasks correctly', async function () {
        this.timeout(30000);
        const runner = new mtm.MockTestRunner(path.join(__dirname, 'fakeTasks', 'node16task', 'entry.js'));
        await runner.LoadAsync();
        const nodePath = runner.nodePath;
        assert(nodePath, 'node path should have been correctly set');
        const version = ncp.execSync(nodePath + ' -v').toString().trim();
        assert(semver.satisfies(version, '16.x'), 'Downloaded node version should be Node 16 instead of ' + version);
    })

    it('MockTest handles node tasks correctly by async call', async function() {
        this.timeout(30000);
        const runner = await (new mtm.MockTestRunner).LoadAsync(path.join(__dirname, 'fakeTasks', 'node16task', 'entry.js'));
        const nodePath = runner.nodePath;
        assert(nodePath, 'node path should have been correctly set');
        const version = ncp.execSync(nodePath + ' -v').toString().trim();
        assert(semver.satisfies(version, '16.x'), 'Downloaded node version should be Node 16 instead of ' + version);
        await Promise.resolve()
    })

    it('MockTest handles node 20 tasks correctly', async function () {
        this.timeout(30000);
        const runner = await (new mtm.MockTestRunner).LoadAsync(path.join(__dirname, 'fakeTasks', 'node20task', 'entry.js'));
        const nodePath = runner.nodePath;
        assert(nodePath, 'node path should have been correctly set');
        const version = ncp.execSync(nodePath + ' -v').toString().trim();
        assert(semver.satisfies(version, '20.x'), 'Downloaded node version should be Node 20 instead of ' + version);
        await Promise.resolve()
    })

    it('MockTest handles node tasks correctly by async call', async () => {
        this.timeout(30000);
        const runner = await (new mtm.MockTestRunner).LoadAsync(path.join(__dirname, 'fakeTasks', 'node16task', 'entry.js'));
        const nodePath = runner.nodePath;
        assert(nodePath, 'node path should have been correctly set');
        const version = ncp.execSync(nodePath + ' -v').toString().trim();
        assert(semver.satisfies(version, '16.x'), 'Downloaded node version should be Node 16 instead of ' + version);
        await Promise.resolve()
    })
});
