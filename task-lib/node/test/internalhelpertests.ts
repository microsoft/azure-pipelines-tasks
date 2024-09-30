// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as testutil from './testutil';
import * as tl from '../_build/task';
import * as im from '../_build/internal';
import * as mockery from '../_build/lib-mocker'

describe('Internal String Helper Tests: _truncateBeforeSensitiveKeyword', function () {
    
    it('truncates before known sensitive keywords', () => {
        const input = "this is a secret password";

        const result = im._truncateBeforeSensitiveKeyword(input, /secret/i);

        assert.strictEqual(result, "this is a ...");
    });

    it('does not truncate without sensitive keyword', () => {
        const input = "this is a secret password";

        const result = im._truncateBeforeSensitiveKeyword(input, /key/i);

        assert.strictEqual(result, input);
    });

    it('process undefined gracefully', () => {
        const input: string = undefined;

        const result = im._truncateBeforeSensitiveKeyword(input, /key/i);

        assert.strictEqual(result, input);
    });
});

describe('Internal Path Helper Tests', function () {

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

    function assertEnsureRooted(root: string, path: string, expected: string): void {
        assert.equal(
            im._ensureRooted(root, path),
            expected,
            `expected ensureRooted for input <${path}> to yield <${expected}>`);
    }

    it('ensureRooted roots paths', (done) => {
        this.timeout(1000);

        if (process.platform == 'win32') {
            // already rooted - drive root
            assertEnsureRooted('D:\\', 'C:/', 'C:/');
            assertEnsureRooted('D:\\', 'a:/hello', 'a:/hello');
            assertEnsureRooted('D:\\', 'C:\\', 'C:\\');
            assertEnsureRooted('D:\\', 'C:\\hello', 'C:\\hello');

            // already rooted - relative drive root
            assertEnsureRooted('D:\\', 'C:', 'C:');
            assertEnsureRooted('D:\\', 'C:hello', 'C:hello');
            assertEnsureRooted('D:\\', 'C:hello/world', 'C:hello/world');
            assertEnsureRooted('D:\\', 'C:hello\\world', 'C:hello\\world');

            // already rooted - current drive root
            assertEnsureRooted('D:\\', '/', '/');
            assertEnsureRooted('D:\\', '/hello', '/hello');
            assertEnsureRooted('D:\\', '\\', '\\');
            assertEnsureRooted('D:\\', '\\hello', '\\hello');

            // already rooted - UNC
            assertEnsureRooted('D:\\', '//machine/share', '//machine/share');
            assertEnsureRooted('D:\\', '\\\\machine\\share', '\\\\machine\\share');

            // relative
            assertEnsureRooted('D:', 'hello', 'D:hello');
            assertEnsureRooted('D:/', 'hello', 'D:/hello');
            assertEnsureRooted('D:/', 'hello/world', 'D:/hello/world');
            assertEnsureRooted('D:\\', 'hello', 'D:\\hello');
            assertEnsureRooted('D:\\', 'hello\\world', 'D:\\hello\\world');
            assertEnsureRooted('D:/root', 'hello', 'D:/root\\hello');
            assertEnsureRooted('D:/root', 'hello/world', 'D:/root\\hello/world');
            assertEnsureRooted('D:\\root', 'hello', 'D:\\root\\hello');
            assertEnsureRooted('D:\\root', 'hello\\world', 'D:\\root\\hello\\world');
            assertEnsureRooted('D:/root/', 'hello', 'D:/root/hello');
            assertEnsureRooted('D:/root/', 'hello/world', 'D:/root/hello/world');
            assertEnsureRooted('D:\\root\\', 'hello', 'D:\\root\\hello');
            assertEnsureRooted('D:\\root\\', 'hello\\world', 'D:\\root\\hello\\world');
        }
        else {
            // already rooted
            assertEnsureRooted('/root', '/', '/');
            assertEnsureRooted('/root', '/hello', '/hello');
            assertEnsureRooted('/root', '/hello/world', '/hello/world');

            // not already rooted - Windows style drive root
            assertEnsureRooted('/root', 'C:/', '/root/C:/');
            assertEnsureRooted('/root', 'C:/hello', '/root/C:/hello');
            assertEnsureRooted('/root', 'C:\\', '/root/C:\\');

            // not already rooted - Windows style relative drive root
            assertEnsureRooted('/root', 'C:', '/root/C:');
            assertEnsureRooted('/root', 'C:hello/world', '/root/C:hello/world');

            // not already rooted - Windows style current drive root
            assertEnsureRooted('/root', '\\', '/root/\\');
            assertEnsureRooted('/root', '\\hello\\world', '/root/\\hello\\world');

            // not already rooted - Windows style UNC
            assertEnsureRooted('/root', '\\\\machine\\share', '/root/\\\\machine\\share');

            // not already rooted - relative
            assertEnsureRooted('/', 'hello', '/hello');
            assertEnsureRooted('/', 'hello/world', '/hello/world');
            assertEnsureRooted('/', 'hello\\world', '/hello\\world');
            assertEnsureRooted('/root', 'hello', '/root/hello');
            assertEnsureRooted('/root', 'hello/world', '/root/hello/world');
            assertEnsureRooted('/root', 'hello\\world', '/root/hello\\world');
            assertEnsureRooted('/root/', 'hello', '/root/hello');
            assertEnsureRooted('/root/', 'hello/world', '/root/hello/world');
            assertEnsureRooted('/root/', 'hello\\world', '/root/hello\\world');
            assertEnsureRooted('/root\\', 'hello', '/root\\/hello');
            assertEnsureRooted('/root\\', 'hello/world', '/root\\/hello/world');
            assertEnsureRooted('/root\\', 'hello\\world', '/root\\/hello\\world');
        }

        done();
    });

    function assertDirectoryName(path: string, expected: string): void {
        assert.equal(
            im._getDirectoryName(path),
            expected,
            `expected getDirectoryName for input <${path}> to yield <${expected}>`);
    }

    it('getDirectoryName interprets directory name from paths', (done) => {
        this.timeout(1000);

        assertDirectoryName(null, '');
        assertDirectoryName('', '');
        assertDirectoryName('.', '');
        assertDirectoryName('..', '');
        assertDirectoryName('hello', '');
        assertDirectoryName('hello/', 'hello');
        assertDirectoryName('hello/world', 'hello');

        if (process.platform == 'win32') {
            // removes redundant slashes
            assertDirectoryName('C:\\\\hello\\\\\\world\\\\', 'C:\\hello\\world');
            assertDirectoryName('C://hello///world//', 'C:\\hello\\world');
            // relative root:
            assertDirectoryName('\\hello\\\\world\\\\again\\\\', '\\hello\\world\\again');
            assertDirectoryName('/hello///world//again//', '\\hello\\world\\again');
            // unc:
            assertDirectoryName('\\\\hello\\world\\again\\', '\\\\hello\\world\\again');
            assertDirectoryName('\\\\hello\\\\\\world\\\\again\\\\', '\\\\hello\\world\\again');
            assertDirectoryName('\\\\\\hello\\\\\\world\\\\again\\\\', '\\\\hello\\world\\again');
            assertDirectoryName('\\\\\\\\hello\\\\\\world\\\\again\\\\', '\\\\hello\\world\\again');
            assertDirectoryName('//hello///world//again//', '\\\\hello\\world\\again');
            assertDirectoryName('///hello///world//again//', '\\\\hello\\world\\again');
            assertDirectoryName('/////hello///world//again//', '\\\\hello\\world\\again');
            // relative:
            assertDirectoryName('hello\\world', 'hello');

            // directory trimming
            assertDirectoryName('a:/hello', 'a:\\');
            assertDirectoryName('z:/hello', 'z:\\');
            assertDirectoryName('A:/hello', 'A:\\');
            assertDirectoryName('Z:/hello', 'Z:\\');
            assertDirectoryName('C:/', '');
            assertDirectoryName('C:/hello', 'C:\\');
            assertDirectoryName('C:/hello/', 'C:\\hello');
            assertDirectoryName('C:/hello/world', 'C:\\hello');
            assertDirectoryName('C:/hello/world/', 'C:\\hello\\world');
            assertDirectoryName('C:', '');
            assertDirectoryName('C:hello', 'C:');
            assertDirectoryName('C:hello/', 'C:hello');
            assertDirectoryName('C:hello/world', 'C:hello');
            assertDirectoryName('C:hello/world/', 'C:hello\\world');
            assertDirectoryName('/', '');
            assertDirectoryName('/hello', '\\');
            assertDirectoryName('/hello/', '\\hello');
            assertDirectoryName('/hello/world', '\\hello');
            assertDirectoryName('/hello/world/', '\\hello\\world');
            assertDirectoryName('\\', '');
            assertDirectoryName('\\hello', '\\');
            assertDirectoryName('\\hello\\', '\\hello');
            assertDirectoryName('\\hello\\world', '\\hello');
            assertDirectoryName('\\hello\\world\\', '\\hello\\world');
            assertDirectoryName('//hello', '');
            assertDirectoryName('//hello/', '');
            assertDirectoryName('//hello/world', '');
            assertDirectoryName('//hello/world/', '\\\\hello\\world');
            assertDirectoryName('\\\\hello', '');
            assertDirectoryName('\\\\hello\\', '');
            assertDirectoryName('\\\\hello\\world', '');
            assertDirectoryName('\\\\hello\\world\\', '\\\\hello\\world');
            assertDirectoryName('//hello/world/again', '\\\\hello\\world');
            assertDirectoryName('//hello/world/again/', '\\\\hello\\world\\again');
            assertDirectoryName('hello/world/', 'hello\\world');
            assertDirectoryName('hello/world/again', 'hello\\world');
            assertDirectoryName('../../hello', '..\\..');
        }
        else {
            // should not converts slashes
            assertDirectoryName('/hello\\world', '/');
            assertDirectoryName('/hello\\world/', '/hello\\world');
            assertDirectoryName('\\\\hello\\world\\again', '');
            assertDirectoryName('\\\\hello\\world/', '\\\\hello\\world');
            assertDirectoryName('\\\\hello\\world/again', '\\\\hello\\world');
            assertDirectoryName('hello\\world', '');
            assertDirectoryName('hello\\world/', 'hello\\world');

            // should remove redundant slashes (rooted paths; UNC format not special)
            assertDirectoryName('//hello', '/');
            assertDirectoryName('//hello/world', '/hello');
            assertDirectoryName('//hello/world/', '/hello/world');
            assertDirectoryName('//hello//world//', '/hello/world');
            assertDirectoryName('///hello////world///', '/hello/world');

            // should remove redundant slashes (relative paths)
            assertDirectoryName('hello//world//again//', 'hello/world/again');
            assertDirectoryName('hello///world///again///', 'hello/world/again');

            // directory trimming (Windows drive root format not special)
            assertDirectoryName('C:/', 'C:');
            assertDirectoryName('C:/hello', 'C:');
            assertDirectoryName('C:/hello/', 'C:/hello');
            assertDirectoryName('C:/hello/world', 'C:/hello');
            assertDirectoryName('C:/hello/world/', 'C:/hello/world');
            assertDirectoryName('C:', '');
            assertDirectoryName('C:hello', '');
            assertDirectoryName('C:hello/', 'C:hello');
            assertDirectoryName('C:hello/world', 'C:hello');
            assertDirectoryName('C:hello/world/', 'C:hello/world');

            // directory trimming (rooted paths)
            assertDirectoryName('/', '');
            assertDirectoryName('/hello', '/');
            assertDirectoryName('/hello/', '/hello');
            assertDirectoryName('/hello/world', '/hello');
            assertDirectoryName('/hello/world/', '/hello/world');

            // directory trimming (relative paths)
            assertDirectoryName('hello/world/', 'hello/world');
            assertDirectoryName('hello/world/again', 'hello/world');
            assertDirectoryName('../../hello', '../..');
        }

        done();
    });

    function assertIsRooted(path: string, expected: boolean): void {
        assert.equal(
            im._isRooted(path),
            expected,
            `expected isRooted for input <${path}> to yield <${expected}>`);
    }

    it('isRooted detects root', (done) => {
        this.timeout(1000);

        if (process.platform == 'win32') {
            // drive root
            assertIsRooted('C:/', true);
            assertIsRooted('a:/hello', true);
            assertIsRooted('c:/hello', true);
            assertIsRooted('z:/hello', true);
            assertIsRooted('A:/hello', true);
            assertIsRooted('C:/hello', true);
            assertIsRooted('Z:/hello', true);
            assertIsRooted('C:\\', true);
            assertIsRooted('C:\\hello', true);

            // relative drive root
            assertIsRooted('C:', true);
            assertIsRooted('C:hello', true);
            assertIsRooted('C:hello/world', true);
            assertIsRooted('C:hello\\world', true);

            // current drive root
            assertIsRooted('/', true);
            assertIsRooted('/hello', true);
            assertIsRooted('/hello/world', true);
            assertIsRooted('\\', true);
            assertIsRooted('\\hello', true);
            assertIsRooted('\\hello\\world', true);

            // UNC
            assertIsRooted('//machine/share', true);
            assertIsRooted('//machine/share/', true);
            assertIsRooted('//machine/share/hello', true);
            assertIsRooted('\\\\machine\\share', true);
            assertIsRooted('\\\\machine\\share\\', true);
            assertIsRooted('\\\\machine\\share\\hello', true);

            // relative
            assertIsRooted('hello', false);
            assertIsRooted('hello/world', false);
            assertIsRooted('hello\\world', false);
        }
        else {
            // root
            assertIsRooted('/', true);
            assertIsRooted('/hello', true);
            assertIsRooted('/hello/world', true);

            // Windows style drive root - false on OSX/Linux
            assertIsRooted('C:/', false);
            assertIsRooted('a:/hello', false);
            assertIsRooted('c:/hello', false);
            assertIsRooted('z:/hello', false);
            assertIsRooted('A:/hello', false);
            assertIsRooted('C:/hello', false);
            assertIsRooted('Z:/hello', false);
            assertIsRooted('C:\\', false);
            assertIsRooted('C:\\hello', false);

            // Windows style relative drive root - false on OSX/Linux
            assertIsRooted('C:', false);
            assertIsRooted('C:hello', false);
            assertIsRooted('C:hello/world', false);
            assertIsRooted('C:hello\\world', false);

            // Windows style current drive root - false on OSX/Linux
            assertIsRooted('\\', false);
            assertIsRooted('\\hello', false);
            assertIsRooted('\\hello\\world', false);

            // Windows style UNC - false on OSX/Linux
            assertIsRooted('\\\\machine\\share', false);
            assertIsRooted('\\\\machine\\share\\', false);
            assertIsRooted('\\\\machine\\share\\hello', false);

            // relative
            assertIsRooted('hello', false);
            assertIsRooted('hello/world', false);
            assertIsRooted('hello\\world', false);
        }

        done();
    });

    function assertNormalizeSeparators(path: string, expected: string): void {
        assert.equal(
            im._normalizeSeparators(path),
            expected,
            `expected normalizeSeparators for input <${path}> to yield <${expected}>`);
    }

    it('normalizeSeparators', (done) => {
        this.timeout(1000);

        if (process.platform == 'win32') {
            // drive-rooted
            assertNormalizeSeparators('C:/', 'C:\\');
            assertNormalizeSeparators('C:/hello', 'C:\\hello');
            assertNormalizeSeparators('C:\\', 'C:\\');
            assertNormalizeSeparators('C:\\hello', 'C:\\hello');
            assertNormalizeSeparators('C:', 'C:');
            assertNormalizeSeparators('C:hello', 'C:hello');
            assertNormalizeSeparators('C:hello/world', 'C:hello\\world');
            assertNormalizeSeparators('C:hello\\world', 'C:hello\\world');
            assertNormalizeSeparators('/', '\\');
            assertNormalizeSeparators('/hello', '\\hello');
            assertNormalizeSeparators('/hello/world', '\\hello\\world');
            assertNormalizeSeparators('/hello//world', '\\hello\\world');
            assertNormalizeSeparators('\\', '\\');
            assertNormalizeSeparators('\\hello', '\\hello');
            assertNormalizeSeparators('\\hello\\', '\\hello\\');
            assertNormalizeSeparators('\\hello\\world', '\\hello\\world');
            assertNormalizeSeparators('\\hello\\\\world', '\\hello\\world');

            // UNC
            assertNormalizeSeparators('//machine/share', '\\\\machine\\share');
            assertNormalizeSeparators('//machine/share/', '\\\\machine\\share\\');
            assertNormalizeSeparators('//machine/share/hello', '\\\\machine\\share\\hello');
            assertNormalizeSeparators('///machine/share', '\\\\machine\\share');
            assertNormalizeSeparators('\\\\machine\\share', '\\\\machine\\share');
            assertNormalizeSeparators('\\\\machine\\share\\', '\\\\machine\\share\\');
            assertNormalizeSeparators('\\\\machine\\share\\hello', '\\\\machine\\share\\hello');
            assertNormalizeSeparators('\\\\\\machine\\share', '\\\\machine\\share');

            // relative
            assertNormalizeSeparators('hello', 'hello');
            assertNormalizeSeparators('hello/world', 'hello\\world');
            assertNormalizeSeparators('hello//world', 'hello\\world');
            assertNormalizeSeparators('hello\\world', 'hello\\world');
            assertNormalizeSeparators('hello\\\\world', 'hello\\world');
        }
        else {
            // rooted
            assertNormalizeSeparators('/', '/');
            assertNormalizeSeparators('/hello', '/hello');
            assertNormalizeSeparators('/hello/world', '/hello/world');

            // backslash not converted
            assertNormalizeSeparators('C:\\', 'C:\\');
            assertNormalizeSeparators('C:\\\\hello\\\\', 'C:\\\\hello\\\\');
            assertNormalizeSeparators('\\', '\\');
            assertNormalizeSeparators('\\hello', '\\hello');
            assertNormalizeSeparators('\\hello\\world', '\\hello\\world');
            assertNormalizeSeparators('hello\\world', 'hello\\world');

            // UNC not converted
            assertNormalizeSeparators('\\\\machine\\share', '\\\\machine\\share');

            // UNC not preserved
            assertNormalizeSeparators('//machine/share', '/machine/share');

            // relative
            assertNormalizeSeparators('hello', 'hello');
            assertNormalizeSeparators('hello/////world', 'hello/world');
        }

        done();
    });
    
    it('ReportMissingStrings', (done) => {
        mockery.registerAllowable('../_build/internal')
        const fsMock = {
            statSync: function (path) { return null; }
        };
        mockery.registerMock('fs', fsMock);
        mockery.enable({ useCleanCache: true })

        const local_im = require('../_build/internal');

        try{
            const localizedMessage : string = local_im._loc("gizmo", "whatever", "music");
            assert.strictEqual(localizedMessage, "gizmo whatever music");

        }finally{
            mockery.disable();
            mockery.deregisterAll();
        }
        done();
    });

    it('ReportMissingLocalization', (done) => {
        const localizedMessage : string = im._loc("gizmo", "whatever", "music");
        assert.strictEqual(localizedMessage, "gizmo whatever music");
        done();
    });
});