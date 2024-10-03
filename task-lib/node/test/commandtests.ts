// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tcm from '../_build/taskcommand';

import testutil = require('./testutil');

describe('Command Tests', function () {

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

    it('constructs', function (done) {
        this.timeout(1000);

        assert(tcm.TaskCommand, 'TaskCommand should be available');
        var tc = new tcm.TaskCommand('some.cmd', { foo: 'bar' }, 'a message');
        assert(tc, 'TaskCommand constructor works');

        done();
    })

    it('toStrings', function (done) {
        this.timeout(1000);

        var tc = new tcm.TaskCommand('some.cmd', { foo: 'bar' }, 'a message');
        assert(tc, 'TaskCommand constructor works');
        var cmdStr = tc.toString();
        assert.equal(cmdStr, '##vso[some.cmd foo=bar;]a message');
        done();
    })

    it('toString escapes message', function (done) {
        this.timeout(1000);

        var tc = new tcm.TaskCommand('some.cmd', { foo: 'bar' }, 'cr \r lf \n crlf \r\n eom ] ;');
        assert(tc, 'TaskCommand constructor works');
        var cmdStr = tc.toString();
        assert.equal(cmdStr, '##vso[some.cmd foo=bar;]cr %0D lf %0A crlf %0D%0A eom ] ;');
        done();
    })

    it('toString handles non string value in properties', function (done) {
        this.timeout(1000);

        var tc = new tcm.TaskCommand('some.cmd', { foo: ['bar', 'baz'] }, 'cr \r lf \n crlf \r\n eom ] ;');
        assert(tc, 'TaskCommand constructor works');
        var cmdStr = tc.toString();
        assert.equal(cmdStr, '##vso[some.cmd foo=bar,baz;]cr %0D lf %0A crlf %0D%0A eom ] ;');
        done();
    })

    it ('toString escapes properties', function (done) {
        this.timeout(1000);

        var tc = new tcm.TaskCommand('some.cmd', { foo: ';=\r=\n%3B' }, 'dog');
        assert(tc, 'TaskCommand constructor works');
        var cmdStr = tc.toString();
        assert.equal(cmdStr, '##vso[some.cmd foo=%3B=%0D=%0A%AZP253B;]dog');
        done();
    })

    it ('toString writes isOutput', function (done) {
        this.timeout(1000);

        var tc = new tcm.TaskCommand('task.setvariable', { variable: 'bar', isOutput: 'true' }, 'dog');
        assert(tc, 'TaskCommand constructor works');
        var cmdStr = tc.toString();
        assert.equal(cmdStr, '##vso[task.setvariable variable=bar;isOutput=true;]dog');
        done();
    })

    it('handles null properties', function (done) {
        this.timeout(1000);

        var tc = new tcm.TaskCommand('some.cmd', null, 'a message');
        assert.equal(tc.toString(), '##vso[some.cmd]a message');
        done();
    })

    it('parses cmd with no properties', function (done) {
        var cmdStr = '##vso[basic.command]messageVal';

        var tc = tcm.commandFromString(cmdStr);

        assert(tc.command === 'basic.command', 'cmd should be correct');
        assert(Object.keys(tc.properties).length == 0, 'should have no properties.');
        assert.equal(tc.message, 'messageVal', 'message is correct');
        done();
    })

    it('parses basic cmd with values', function (done) {
        var cmdStr = '##vso[basic.command prop1=val1;]messageVal';

        var tc = tcm.commandFromString(cmdStr);

        assert(tc.command === 'basic.command', 'cmd should be correct');
        assert(tc.properties['prop1'], 'should be a property names prop1');
        assert.equal(Object.keys(tc.properties).length, 1, 'should have one property.');
        assert.equal(tc.properties['prop1'], 'val1', 'property value is correct');
        assert.equal(tc.message, 'messageVal', 'message is correct');
        done();
    })

    it('parses basic cmd with multiple properties no trailing semi', function (done) {
        var cmdStr = '##vso[basic.command prop1=val1;prop2=val2]messageVal';

        var tc = tcm.commandFromString(cmdStr);

        assert(tc.command === 'basic.command', 'cmd should be correct');
        assert(tc.properties['prop1'], 'should be a property names prop1');
        assert.equal(Object.keys(tc.properties).length, 2, 'should have one property.');
        assert.equal(tc.properties['prop1'], 'val1', 'property value is correct');
        assert.equal(tc.properties['prop2'], 'val2', 'property value is correct');
        assert.equal(tc.message, 'messageVal', 'message is correct');
        done();
    })

    it('parses values with spaces in them', function (done) {
        var cmdStr = '##vso[task.setvariable variable=task variable;]task variable set value';

        var tc = tcm.commandFromString(cmdStr);
        assert.equal(tc.command, 'task.setvariable', 'cmd should be task.setvariable');
        assert(tc.properties['variable'], 'should be a property names variable');
        assert.equal(tc.properties['variable'], 'task variable', 'property variable is correct');
        assert.equal(tc.message, 'task variable set value');
        done();
    })

    it('parses and unescapes message', function (done) {
        var cmdStr = '##vso[basic.command]cr %0D lf %0A crlf %0D%0A eom ] ;';

        var tc = tcm.commandFromString(cmdStr);
        assert.equal(tc.command, 'basic.command', 'cmd should be basic.command');
        assert.equal(tc.message, 'cr \r lf \n crlf \r\n eom ] ;');
        done();
    })

    it ('parses and unescapes properties', function (done) {
        var cmdStr = '##vso[basic.command foo=%3B=%0D=%0A%AZP253B;]dog';

        var tc = tcm.commandFromString(cmdStr);
        assert.equal(tc.command, 'basic.command', 'cmd should be basic.command');
        assert.equal(tc.properties['foo'], ';=\r=\n%3B', 'property should be unescaped')
        assert.equal(tc.message, 'dog');
        done();
    })

    it('handles empty properties', function (done) {
        this.timeout(1000);

        var tc = new tcm.TaskCommand('some.cmd', {}, 'a message');
        assert.equal(tc.toString(), '##vso[some.cmd]a message');
        done();
    })
});
