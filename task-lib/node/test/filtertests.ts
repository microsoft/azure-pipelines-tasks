// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Filter Tests', function () {

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

    it('applies default option nobrace true', (done) => {
        this.timeout(1000);

        let list = [
            '/brace-test/brace_{hello,world}.txt',
            '/brace-test/brace_hello.txt',
            '/brace-test/brace_world.txt',
        ];
        let pattern = '/brace-test/brace_{hello,world}.txt';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected: string[] = [
            '/brace-test/brace_{hello,world}.txt'
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option noglobstar false', (done) => {
        this.timeout(1000);

        let list = [
            '/glob-star-test/hello/world/hello-world.txt',
            '/glob-star-test/hello/hello.txt',
            '/glob-star-test/glob-star-test.txt',
        ];
        let pattern = '/glob-star-test/**';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected = [
            '/glob-star-test/hello/world/hello-world.txt',
            '/glob-star-test/hello/hello.txt',
            '/glob-star-test/glob-star-test.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option dot true', (done) => {
        this.timeout(1000);

        let list = [
            '/dot-test/.hello/.world.txt',
            '/dot-test/.hello/other.zzz',
        ];
        let pattern = '/dot-test/*/*.txt';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected = [
            '/dot-test/.hello/.world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option noext false', (done) => {
        this.timeout(1000);

        let list = [
            '/ext-glob-test/@(hello|world).txt',
            '/ext-glob-test/hello.txt',
            '/ext-glob-test/world.txt',
        ];
        let pattern = '/ext-glob-test/@(hello|world).txt';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected = [
            '/ext-glob-test/hello.txt',
            '/ext-glob-test/world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option nocase based on platform', (done) => {
        this.timeout(1000);

        let list = [
            '/case-test/hello.txt',
            '/case-test/world.TXT',
        ];
        let pattern = '/case-test/*.txt';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected: string[] = [];
        expected.push('/case-test/hello.txt');
        if (process.platform == 'win32') {
            expected.push('/case-test/world.TXT');
        }

        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option matchBase false', (done) => {
        this.timeout(1000);

        let list = [
            '/match-base-test/match-base-file.txt',
            'match-base-file.txt',
        ];
        let pattern = 'match-base-file.txt';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected = [
            'match-base-file.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option nocomment false', (done) => {
        this.timeout(1000);

        let list = [
            '#comment-test',
        ];
        let pattern = '#comment-test';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected = [];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option nonegate false', (done) => {
        this.timeout(1000);

        let list = [
            '/negate-test/hello.txt',
            '/negate-test/world.txt',
        ];
        let pattern = '!/negate-test/hello.txt';
        let actual: string[] = list.filter(tl.filter(pattern));
        let expected = [
            '/negate-test/world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports custom options', (done) => {
        this.timeout(1000);

        let list = [
            '/brace-test/brace_{hello,world}.txt',
            '/brace-test/brace_hello.txt',
            '/brace-test/brace_world.txt',
        ];
        let pattern = '/brace-test/brace_{hello,world}.txt';
        let actual: string[] = list.filter(tl.filter(pattern, <tl.MatchOptions>{ nobrace: false }));
        let expected = [
            '/brace-test/brace_hello.txt',
            '/brace-test/brace_world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });
});
