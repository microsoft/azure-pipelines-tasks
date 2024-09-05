// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Match Tests', function () {

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

    it('single pattern', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj2/readme.txt'
        ];
        let pattern: string = '/projects/**/*.proj';
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, pattern, null, options);
        assert.equal(result.length, 2);
        assert.equal(result[0], '/projects/myproj1/myproj1.proj');
        assert.equal(result[1], '/projects/myproj2/myproj2.proj');

        done();
    });

    it('aggregates matches', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj3/myproj3.proj'
        ];
        let patterns: string[] = [
            '/projects/**/myproj1.proj',
            '/projects/**/myproj2.proj'
        ];
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, patterns, null, options);
        assert.equal(result.length, 2);
        assert.equal(result[0], '/projects/myproj1/myproj1.proj');
        assert.equal(result[1], '/projects/myproj2/myproj2.proj');

        done();
    });

    it('does not duplicate matches', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/solution1/proj1.proj',
            '/solution1/proj2.proj',
            '/solution2/proj1.proj',
            '/not-included/readme.txt'
        ];
        let patterns: string[] = [
            '/solution1/proj*.proj',
            '/**/proj1.proj'
        ];
        let actual: string[] = tl.match(list, patterns);
        let expected: string[] = [
            '/solution1/proj1.proj',
            '/solution1/proj2.proj',
            '/solution2/proj1.proj',
        ]
        assert.deepEqual(actual, expected);

        done();
    });

    it('preserves order', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj3/myproj3.proj',
            '/projects/myproj4/myproj4.proj',
            '/projects/myproj5/myproj5.proj'
        ];
        let patterns: string[] = [
            '/projects/**/myproj2.proj', // mix up the order
            '/projects/**/myproj5.proj',
            '/projects/**/myproj3.proj',
            '/projects/**/myproj1.proj',
            '/projects/**/myproj4.proj',
        ];
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, patterns, null, options);
        assert.equal(result.length, 5);
        assert.equal(result[0], '/projects/myproj1/myproj1.proj'); // should follow original list order
        assert.equal(result[1], '/projects/myproj2/myproj2.proj');
        assert.equal(result[2], '/projects/myproj3/myproj3.proj');
        assert.equal(result[3], '/projects/myproj4/myproj4.proj');
        assert.equal(result[4], '/projects/myproj5/myproj5.proj');

        done();
    });

    it('supports interleaved exclude patterns', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/solution1/proj1/proj1.proj',
            '/solution1/proj1/README.txt',
            '/solution1/proj2/proj2.proj',
            '/solution1/proj2/README.txt',
            '/solution1/solution1.sln',
            '/solution2/proj1/proj1.proj',
            '/solution2/proj1/README.txt',
            '/solution2/proj2/proj2.proj',
            '/solution2/proj2/README.txt',
            '/solution2/solution2.sln',
        ];
        let patterns: string[] = [
            '**/@(*.proj|README.txt)',  // include all proj and README files
            '!**/solution2/**',         // exclude the solution 2 folder entirely
            '**/*.sln',                 // include all sln files
            '!**/proj2/README.txt'      // exclude proj2 README files
        ];
        let result: string[] = tl.match(list, patterns);
        assert.equal(result.length, 5);
        assert.equal(result[0], '/solution1/proj1/proj1.proj');
        assert.equal(result[1], '/solution1/proj1/README.txt');
        assert.equal(result[2], '/solution1/proj2/proj2.proj');
        assert.equal(result[3], '/solution1/solution1.sln');
        assert.equal(result[4], '/solution2/solution2.sln');

        done();
    });

    it('applies default options', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/brace-test/brace_{hello,world}.txt',
            '/brace-test/brace_hello.txt',
            '/brace-test/brace_world.txt',
            '/glob-star-test/hello/world/hello-world.txt',
            '/glob-star-test/hello/hello.txt',
            '/glob-star-test/glob-star-test.txt',
            '/dot-test/.hello/.world.txt',
            '/dot-test/.hello/other.zzz',
            '/ext-glob-test/@(hello|world).txt',
            '/ext-glob-test/hello.txt',
            '/ext-glob-test/world.txt',
            '/case-test/hello.txt',
            '/case-test/world.TXT',
            '/match-base-test/match-base-file.txt',
            'match-base-file.txt',
            '#comment-test',
            '!/negate-test/hello.txt',
            '/negate-test/hello.txt',
            '/negate-test/world.txt',
        ];
        let patterns: string[] = [
            '/brace-test/brace_{hello,world}.txt',
            '/glob-star-test/**',
            '/dot-test/*/*.txt',
            '/ext-glob-test/@(hello|world).txt',
            '/case-test/*.txt',
            'match-base-file.txt',
            '#comment-test',
            '/negate-test/*',
            '!/negate-test/hello.txt',
        ];
        let actual: string[] = tl.match(list, patterns);
        let expected: string[] = [];
        expected.push('/brace-test/brace_{hello,world}.txt');
        expected.push('/glob-star-test/hello/world/hello-world.txt');
        expected.push('/glob-star-test/hello/hello.txt');
        expected.push('/glob-star-test/glob-star-test.txt');
        expected.push('/dot-test/.hello/.world.txt');
        expected.push('/ext-glob-test/hello.txt');
        expected.push('/ext-glob-test/world.txt');
        expected.push('/case-test/hello.txt');
        if (process.platform == 'win32') {
            expected.push('/case-test/world.TXT');
        }

        expected.push('match-base-file.txt');
        expected.push('/negate-test/world.txt');
        assert.deepEqual(actual, expected);

        done();
    });

    it('trims patterns', (done) => {
        this.timeout(1000);

        let list: string[] = [
            ' hello-world.txt ',
            'hello-world.txt',
        ];
        let patterns: string[] = [
            ' hello-world.txt ',
        ];
        let actual: string[] = tl.match(list, patterns);
        let expected: string[] = [
            'hello-world.txt'
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('skips empty patterns', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '',
            ' ',
            'hello-world.txt',
        ];
        let patterns: string[] = [
            '',
            ' ',
            'hello-world.txt',
        ];
        let actual: string[] = tl.match(list, patterns);
        let expected: string[] = [
            'hello-world.txt'
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports nocomment true', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '#hello-world.txt',
            'hello-world.txt',
        ];
        let patterns: string[] = [
            '#hello-world.txt',
        ];
        let actual: string[] = tl.match(list, patterns, null, <tl.MatchOptions>{ nocomment: true });
        let expected: string[] = [
            '#hello-world.txt'
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports nonegate true', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '!hello-world.txt',
            'hello-world.txt',
        ];
        let patterns: string[] = [
            '!hello-world.txt',
        ];
        let actual: string[] = tl.match(list, patterns, null, <tl.MatchOptions>{ nonegate: true });
        let expected: string[] = [
            '!hello-world.txt'
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports flipNegate true', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '!hello-world.txt',
            'hello-world.txt',
        ];
        let patterns: string[] = [
            '!hello-world.txt',
        ];
        let actual: string[] = tl.match(list, patterns, null, <tl.MatchOptions>{ flipNegate: true });
        let expected: string[] = [
            'hello-world.txt'
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('counts leading negate markers', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/hello/world.txt',
            '/hello/two-negate-markers.txt',
            '/hello/four-negate-markers.txt',
            '/initial-includes/hello.txt',
            '/initial-includes/one-negate-markers.txt',
            '/initial-includes/three-negate-markers.txt',
        ];
        let patterns: string[] = [
            '/initial-includes/*.txt',
            '!!/hello/two-negate-markers.txt',
            '!!!!/hello/four-negate-markers.txt',
            '!/initial-includes/one-negate-markers.txt',
            '!!!/initial-includes/three-negate-markers.txt',
        ];
        let actual: string[] = tl.match(list, patterns);
        let expected: string[] = [
            '/hello/two-negate-markers.txt',
            '/hello/four-negate-markers.txt',
            '/initial-includes/hello.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('trims whitespace after trimming negate markers', (done) => {
        this.timeout(1000);

        let list: string[] = [
            'hello.txt',
            'world.txt',
        ];
        let patterns: string[] = [
            '*',
            '! hello.txt',
        ];
        let actual: string[] = tl.match(list, patterns);
        let expected: string[] = [
            'world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('evaluates comments before negation', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '#hello.txt',
            'hello.txt',
            'world.txt',
        ];
        let patterns: string[] = [
            '*',
            '!#hello.txt',
        ];
        let actual: string[] = tl.match(list, patterns);
        let expected: string[] = [
            'hello.txt',
            'world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies pattern root for include patterns', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/matching/pattern/root/hello.txt',
            '/matching/pattern/root/hello/world.txt',
            '/matching/pattern/root/other.zzz',
            '/non-matching/pattern/root/hello.txt',
            '/non-matching/pattern/root/hello/world.txt',
        ];
        let patterns: string[] = [
            'hello.txt',
            '**/world.txt',
        ];
        let patternRoot = '/matching/pattern/root';
        let actual: string[] = tl.match(list, patterns, patternRoot);
        let expected: string[] = [
            '/matching/pattern/root/hello.txt',
            '/matching/pattern/root/hello/world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies pattern root for exclude patterns', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/matching/pattern/root/hello.txt',
            '/matching/pattern/root/hello/world.txt',
            '/matching/pattern/root/other.zzz',
            '/non-matching/pattern/root/hello.txt',
            '/non-matching/pattern/root/hello/world.txt',
        ];
        let patterns: string[] = [
            '/**/*',
            '!hello.txt',
            '!**/world.txt',
        ];
        let patternRoot = '/matching/pattern/root';
        let actual: string[] = tl.match(list, patterns, patternRoot);
        let expected: string[] = [
            '/matching/pattern/root/other.zzz',
            '/non-matching/pattern/root/hello.txt',
            '/non-matching/pattern/root/hello/world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('does not apply pattern root for basename matchBase include patterns', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/matching/pattern/root/hello.txt',
            '/matching/pattern/root/hello/world.txt',
            '/matching/pattern/root/other.zzz',
            '/non-matching/pattern/root/hello.txt',
            '/non-matching/pattern/root/hello/world.txt',
        ];
        let patterns: string[] = [
            'hello.txt',
            '**/world.txt',
        ];
        let patternRoot = '/matching/pattern/root';
        let options = <tl.MatchOptions>{ matchBase: true };
        let actual: string[] = tl.match(list, patterns, patternRoot, options);
        let expected: string[] = [
            '/matching/pattern/root/hello.txt',
            '/matching/pattern/root/hello/world.txt',
            '/non-matching/pattern/root/hello.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('does not apply pattern root for basename matchBase exclude patterns', (done) => {
        this.timeout(1000);

        let list: string[] = [
            '/matching/pattern/root/hello.txt',
            '/matching/pattern/root/hello/world.txt',
            '/matching/pattern/root/other.zzz',
            '/non-matching/pattern/root/hello.txt',
            '/non-matching/pattern/root/hello/world.txt',
        ];
        let patterns: string[] = [
            '/**/*',
            '!hello.txt',
            '!**/world.txt',
        ];
        let patternRoot = '/matching/pattern/root';
        let options = <tl.MatchOptions>{ matchBase: true };
        let actual: string[] = tl.match(list, patterns, patternRoot, options);
        let expected: string[] = [
            '/matching/pattern/root/other.zzz',
            '/non-matching/pattern/root/hello/world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });
});
