// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tl from '../_build/task';
import * as im from '../_build/internal'
import * as fs from 'fs';
import * as path from 'path';
import testutil = require('./testutil');

describe('Find and Match Tests', function () {

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

        // create the following layout:
        //   hello.txt
        //   world.txt
        //   zzz.zzz
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_single-pattern');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'zzz.zzz'), '');

        let actual: string[] = tl.findMatch('', path.join(root, '*.txt'));
        let expected: string[] = [
            path.join(root, 'hello.txt'),
            path.join(root, 'world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('aggregates matches', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   myproj1.proj
        //   myproj2.proj
        //   myproj3.proj
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_aggregates-matches');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'myproj1.proj'), '');
        fs.writeFileSync(path.join(root, 'myproj2.proj'), '');
        fs.writeFileSync(path.join(root, 'myproj3.proj'), '');
        let patterns: string[] = [
            path.join(root, '*1.proj'),
            path.join(root, '*2.proj'),
        ];

        let actual: string[] = tl.findMatch('', patterns);
        let expected: string[] = [
            path.join(root, 'myproj1.proj'),
            path.join(root, 'myproj2.proj'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports path not found', (done) => {
        this.timeout(1000);

        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-path-not-found');
        tl.mkdirP(root);
        let patterns: string[] = [
            path.join(root, 'NotFound', '*.proj'),
        ];

        let actual: string[] = tl.findMatch('', patterns);
        let expected: string[] = [];
        assert.deepEqual(actual, expected);

        done();
    });

    it('does not duplicate matches', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   solution1/proj1.proj
        //   solution1/proj2.proj
        //   solution2/proj1.proj
        //   not-included/readme.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_does-not-duplicate');
        tl.mkdirP(path.join(root, 'solution1'));
        tl.mkdirP(path.join(root, 'solution2'));
        tl.mkdirP(path.join(root, 'not-included'));
        fs.writeFileSync(path.join(root, 'solution1', 'proj1.proj'), '');
        fs.writeFileSync(path.join(root, 'solution1', 'proj2.proj'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'proj1.proj'), '');
        fs.writeFileSync(path.join(root, 'not-included', 'readme.txt'), '');
        let patterns: string[] = [
            path.join(root, 'solution1', '*.proj'),
            path.join(root, '**', 'proj1.proj'),
        ];

        let actual: string[] = tl.findMatch('', patterns);
        let expected: string[] = [
            path.join(root, 'solution1', 'proj1.proj'),
            path.join(root, 'solution1', 'proj2.proj'),
            path.join(root, 'solution2', 'proj1.proj'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports interleaved exclude patterns', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   solution1/proj1/proj1.proj
        //   solution1/proj1/README.txt
        //   solution1/proj2/proj2.proj
        //   solution1/proj2/README.txt
        //   solution1/solution1.sln
        //   solution2/proj1/proj1.proj
        //   solution2/proj1/README.txt
        //   solution2/proj2/proj2.proj
        //   solution2/proj2/README.txt
        //   solution2/solution2.sln
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-interleaved-exclude-patterns');
        tl.mkdirP(path.join(root, 'solution1', 'proj1'));
        tl.mkdirP(path.join(root, 'solution1', 'proj2'));
        tl.mkdirP(path.join(root, 'solution2', 'proj1'));
        tl.mkdirP(path.join(root, 'solution2', 'proj2'));
        fs.writeFileSync(path.join(root, 'solution1', 'proj1', 'proj1.proj'), '');
        fs.writeFileSync(path.join(root, 'solution1', 'proj1', 'README.txt'), '');
        fs.writeFileSync(path.join(root, 'solution1', 'proj2', 'proj1.proj'), '');
        fs.writeFileSync(path.join(root, 'solution1', 'proj2', 'README.txt'), '');
        fs.writeFileSync(path.join(root, 'solution1', 'solution1.sln'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'proj1', 'proj1.proj'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'proj1', 'README.txt'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'proj2', 'proj1.proj'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'proj2', 'README.txt'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'solution2.sln'), '');
        let patterns: string[] = [
            path.join(root, '**', '@(*.proj|README.txt)'),      // include all proj and README files
            '!' + path.join(root, '**', 'solution2', '**'),     // exclude the solution 2 folder entirely
            path.join(root, '**', '*.sln'),                     // include all sln files
            '!' + path.join(root, '**', 'proj2', 'README.txt'), // exclude proj2 README files
        ];
        let actual: string[] = tl.findMatch('', patterns);
        let expected: string[] = [
            path.join(root, 'solution1', 'proj1', 'proj1.proj'),
            path.join(root, 'solution1', 'proj1', 'README.txt'),
            path.join(root, 'solution1', 'proj2', 'proj2.proj'),
            path.join(root, 'solution1', 'solution1.sln'),
            path.join(root, 'solution2', 'solution2.sln'),
        ];

        done();
    });

    it('applies default match options', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   brace-test/brace_{hello,world}.txt
        //   brace-test/brace_hello.txt
        //   brace-test/brace_world.txt
        //   glob-star-test/hello/world/hello-world.txt
        //   glob-star-test/hello/hello.txt
        //   glob-star-test/glob-star-test.txt
        //   dot-test/.hello/.world.txt
        //   dot-test/.hello/other.zzz
        //   ext-glob-test/+(hello).txt
        //   ext-glob-test/hellohello.txt
        //   ext-glob-test/world.txt
        //   case-test/hello.txt
        //   case-test/world.TXT
        //   match-base-test/match-base-file.txt
        //   match-base-file.txt
        //   #comment-test
        //   !negate-test/hello.txt
        //   negate-test/hello.txt
        //   negate-test/world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_applies-default-options');
        tl.mkdirP(path.join(root, 'brace-test'));
        tl.mkdirP(path.join(root, 'glob-star-test', 'hello', 'world'));
        tl.mkdirP(path.join(root, 'dot-test', '.hello'));
        tl.mkdirP(path.join(root, 'ext-glob-test'));
        tl.mkdirP(path.join(root, 'case-test'));
        tl.mkdirP(path.join(root, 'match-base-test'));
        tl.mkdirP(path.join(root, '!negate-test'));
        tl.mkdirP(path.join(root, 'negate-test'));
        fs.writeFileSync(path.join(root, 'brace-test', 'brace_{hello,world}.txt'), '');
        fs.writeFileSync(path.join(root, 'brace-test', 'brace_hello.txt'), '');
        fs.writeFileSync(path.join(root, 'brace-test', 'brace_world.txt'), '');
        fs.writeFileSync(path.join(root, 'glob-star-test', 'hello', 'world', 'hello-world.txt'), '');
        fs.writeFileSync(path.join(root, 'glob-star-test', 'hello', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'glob-star-test', 'glob-star-test.txt'), '');
        fs.writeFileSync(path.join(root, 'dot-test', '.hello', '.world.txt'), '');
        fs.writeFileSync(path.join(root, 'dot-test', '.hello', 'other.zzz'), '');
        fs.writeFileSync(path.join(root, 'ext-glob-test', '+(hello).txt'), '');
        fs.writeFileSync(path.join(root, 'ext-glob-test', 'hellohello.txt'), '');
        fs.writeFileSync(path.join(root, 'ext-glob-test', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'case-test', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'case-test', 'world.TXT'), '');
        fs.writeFileSync(path.join(root, 'match-base-test', 'match-base-file.txt'), '');
        fs.writeFileSync(path.join(root, 'match-base-file.txt'), '');
        fs.writeFileSync(path.join(root, '#comment-test'), '');
        fs.writeFileSync(path.join(root, '!negate-test', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'negate-test', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'negate-test', 'world.txt'), '');
        let patterns: string[] = [
            'brace-test/brace_{hello,world}.txt',
            'glob-star-test/**',
            'dot-test/*/*.txt',
            'ext-glob-test/+(hello).txt',
            'case-test/*.txt',
            'match-base-file.txt',
            '#comment-test',
            'negate-test/*',
            '!negate-test/hello.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns);
        let expected: string[] = [];
        expected.push(path.join(root, 'brace-test/brace_{hello,world}.txt'));
        expected.push(path.join(root, 'glob-star-test/hello/world'));
        expected.push(path.join(root, 'glob-star-test/hello/world/hello-world.txt'));
        expected.push(path.join(root, 'glob-star-test/hello'));
        expected.push(path.join(root, 'glob-star-test/hello/hello.txt'));
        expected.push(path.join(root, 'glob-star-test/glob-star-test.txt'));
        expected.push(path.join(root, 'dot-test/.hello/.world.txt'));
        expected.push(path.join(root, 'ext-glob-test/hellohello.txt'));
        expected.push(path.join(root, 'case-test/hello.txt'));
        if (process.platform == 'win32') {
            expected.push(path.join(root, 'case-test/world.TXT'));
        }

        expected.push(path.join(root, 'match-base-file.txt'));
        expected.push(path.join(root, 'negate-test/world.txt'));
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('trims patterns', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   ' hello-world.txt '
        //   'hello-world.txt'
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_trims-patterns');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, ' hello-world.txt '), '');
        fs.writeFileSync(path.join(root, 'hello-world.txt'), '');
        let patterns: string[] = [
            ' hello-world.txt ',
        ];
        let actual: string[] = tl.findMatch(root, patterns);
        let expected: string[] = [
            path.join(root, 'hello-world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('skips empty patterns', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   ' '
        //   'hello-world.txt'
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_skips-empty-patterns');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, ' '), '');
        fs.writeFileSync(path.join(root, 'hello-world.txt'), '');
        let patterns: string[] = [
            '',
            ' ',
            'hello-world.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns);
        let expected: string[] = [
            path.join(root, 'hello-world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports nocomment true', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   #hello-world.txt
        //   hello-world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-nocomment-true');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '#hello-world.txt'), '');
        fs.writeFileSync(path.join(root, 'hello-world.txt'), '');
        let patterns: string[] = [
            '#hello-world.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ nocomment: true });
        let expected: string[] = [
            path.join(root, '#hello-world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports nobrace false', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   {hello,world}.txt
        //   world.txt
        //   world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-nobrace-false');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '{hello,world}.txt'), '');
        fs.writeFileSync(path.join(root, 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'world.txt'), '');
        let patterns: string[] = [
            '{hello,world}.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ });
        let expected: string[] = [
            path.join(root, 'hello.txt'),
            path.join(root, 'world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('brace escaping platform-specific', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   {hello,world}.txt
        //   world.txt
        //   world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_brace-escaping-platform-specific');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '{hello,world}.txt'), '');
        fs.writeFileSync(path.join(root, 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'world.txt'), '');
        let patterns: string[] = [
            path.join(root, '\\{hello,world}.txt'),
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ });
        let expected: string[];
        if (process.platform == 'win32') {
            expected = [
                path.join(root, 'hello.txt'),
                path.join(root, 'world.txt'),
            ];
        }
        else {
            expected = [
                path.join(root, '{hello,world}.txt'),
            ];
        }

        assert.deepEqual(actual, expected);

        done();
    });


    it('supports nonegate true', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   !hello-world.txt
        //   hello-world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-nonegate-true');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '!hello-world.txt'), '');
        fs.writeFileSync(path.join(root, 'hello-world.txt'), '');
        let patterns: string[] = [
            '!hello-world.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ nonegate: true });
        let expected: string[] = [
            path.join(root, '!hello-world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports flipNegate true', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   !hello-world.txt
        //   hello-world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-flipNegate-true');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '!hello-world.txt'), '');
        fs.writeFileSync(path.join(root, 'hello-world.txt'), '');
        let patterns: string[] = [
            '!hello-world.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ flipNegate: true });
        let expected: string[] = [
            path.join(root, 'hello-world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports matchBase include patterns', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   include/hello/world/include
        //   include/hello/world/other.txt
        //   include/hello/include
        //   include/hello/other.txt
        //   include/include
        //   include/other.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-matchBase-include');
        tl.mkdirP(path.join(root, 'include', 'hello', 'world'));
        fs.writeFileSync(path.join(root, 'include', 'hello', 'world', 'include'), '');
        fs.writeFileSync(path.join(root, 'include', 'hello', 'world', 'other.txt'), '');
        fs.writeFileSync(path.join(root, 'include', 'hello', 'include'), '');
        fs.writeFileSync(path.join(root, 'include', 'hello', 'other.txt'), '');
        fs.writeFileSync(path.join(root, 'include', 'include'), '');
        fs.writeFileSync(path.join(root, 'include', 'other.txt'), '');
        let patterns: string[] = [
            'include',
        ];
        let actual: string[] = tl.findMatch(path.join(root, 'include'), patterns, null, <tl.MatchOptions>{ matchBase: true });
        let expected: string[] = [
            path.join(root, 'include', 'hello', 'world', 'include'),
            path.join(root, 'include', 'hello', 'include'),
            path.join(root, 'include', 'include'),
            path.join(root, 'include'),
        ];
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('supports matchBase include patterns with glob', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   include/hello/world/include.txt
        //   include/hello/world/other.txt
        //   include/hello/include.txt
        //   include/hello/other.txt
        //   include/include.txt
        //   include/other.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-matchBase-include-with-glob');
        tl.mkdirP(path.join(root, 'include', 'hello', 'world'));
        fs.writeFileSync(path.join(root, 'include', 'hello', 'world', 'include.txt'), '');
        fs.writeFileSync(path.join(root, 'include', 'hello', 'world', 'other.txt'), '');
        fs.writeFileSync(path.join(root, 'include', 'hello', 'include.txt'), '');
        fs.writeFileSync(path.join(root, 'include', 'hello', 'other.txt'), '');
        fs.writeFileSync(path.join(root, 'include', 'include.txt'), '');
        fs.writeFileSync(path.join(root, 'include', 'other.txt'), '');
        let patterns: string[] = [
            '?nclude?(.txt)',
        ];
        let actual: string[] = tl.findMatch(path.join(root, 'include'), patterns, null, <tl.MatchOptions>{ matchBase: true });
        let expected: string[] = [
            path.join(root, 'include', 'hello', 'world', 'include.txt'),
            path.join(root, 'include', 'hello', 'include.txt'),
            path.join(root, 'include', 'include.txt'),
            path.join(root, 'include'),
        ];
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('supports matchBase exlude pattern', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   solution1/proj1/proj1.txt
        //   solution1/proj2/proj2.txt
        //   solution2/proj1/proj1.txt
        //   solution2/proj2/proj2.txt
        //   default-root/zzz.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-matchBase-exclude-pattern');
        tl.mkdirP(path.join(root, 'solution1', 'proj1'));
        tl.mkdirP(path.join(root, 'solution1', 'proj2'));
        tl.mkdirP(path.join(root, 'solution2', 'proj1'));
        tl.mkdirP(path.join(root, 'solution2', 'proj2'));
        tl.mkdirP(path.join(root, 'default-root'));
        fs.writeFileSync(path.join(root, 'solution1', 'proj1', 'proj1.txt'), '');
        fs.writeFileSync(path.join(root, 'solution1', 'proj2', 'proj2.txt'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'proj1', 'proj1.txt'), '');
        fs.writeFileSync(path.join(root, 'solution2', 'proj2', 'proj2.txt'), '');
        fs.writeFileSync(path.join(root, 'default-root', 'zzz.txt'), '');
        let patterns: string[] = [
            path.join(root, 'solution1', '**'),
            path.join(root, 'solution2', '**'),
            '!proj1?(.txt)',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ matchBase: true });
        let expected: string[] = [
            path.join(root, 'solution1', 'proj2'),
            path.join(root, 'solution1', 'proj2', 'proj2.txt'),
            path.join(root, 'solution2', 'proj2'),
            path.join(root, 'solution2', 'proj2', 'proj2.txt'),
        ];
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('counts leading negate markers', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   hello/world.txt
        //   hello/two-negate-markers.txt
        //   hello/four-negate-markers.txt
        //   initial-includes/hello.txt
        //   initial-includes/one-negate-markers.txt
        //   initial-includes/three-negate-markers.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_counts-leading-negate-markers');
        tl.mkdirP(path.join(root, 'hello'));
        tl.mkdirP(path.join(root, 'initial-includes'));
        fs.writeFileSync(path.join(root, 'hello', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'hello', 'two-negate-markers.txt'), '');
        fs.writeFileSync(path.join(root, 'hello', 'four-negate-markers.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'one-negate-markers.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'three-negate-markers.txt'), '');
        let patterns: string[] = [
            'initial-includes/*.txt',
            '!!hello/two-negate-markers.txt',
            '!!!!hello/four-negate-markers.txt',
            '!initial-includes/one-negate-markers.txt',
            '!!!initial-includes/three-negate-markers.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns);
        let expected: string[] = [
            path.join(root, 'hello', 'two-negate-markers.txt'),
            path.join(root, 'hello', 'four-negate-markers.txt'),
            path.join(root, 'initial-includes', 'hello.txt'),
        ];
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('trims whitespace after trimming negate markers', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   hello.txt
        //   world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_trims-whitespace-after-trimming-negate-markers');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'world.txt'), '');
        let patterns: string[] = [
            '*',
            '! hello.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns);
        let expected: string[] = [
            path.join(root, 'world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('evaluates comments before expanding braces', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   #comment
        //   #comment2
        //   #hello.txt
        //   world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_evaluates-comments-before-expanding-braces');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '#comment'), '');
        fs.writeFileSync(path.join(root, '#comment2'), '');
        fs.writeFileSync(path.join(root, '#hello.txt'), '');
        fs.writeFileSync(path.join(root, 'world.txt'), '');
        let patterns: string[] = [
            '#comment',
            '{#hello.txt,world.txt}',
            '#comment2',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ });
        let expected: string[] = [
            path.join(root, '#hello.txt'),
            path.join(root, 'world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('evaluates negation before expanding braces', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   !hello.txt
        //   hello.txt
        //   world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_evaluates-negation-before-expanding-braces');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '!hello.txt'), '');
        fs.writeFileSync(path.join(root, 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'world.txt'), '');
        let patterns: string[] = [
            '*',
            '!{!hello.txt,world.txt}',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ });
        let expected: string[] = [
            path.join(root, 'hello.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('evaluates comments before negation', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   #hello.txt
        //   hello.txt
        //   world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_evaluates-comments-before-negation');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '#hello.txt'), '');
        fs.writeFileSync(path.join(root, 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'world.txt'), '');
        let patterns: string[] = [
            '*',
            '!#hello.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns);
        let expected: string[] = [
            path.join(root, 'hello.txt'),
            path.join(root, 'world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('escapes default root when rooting patterns', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   bracket/hello.txt
        //   bracket/world.txt
        //   ext-plus/hello.txt
        //   ext-plus/world.txt
        //   ext-plus/zzz.txt
        //   brace/hello.txt
        //   brace/world.txt
        //   brace/zzz.txt
        //   initial-includes/bracket/hello.txt
        //   initial-includes/bracket/world.txt
        //   initial-includes/ext-plus/hello.txt
        //   initial-includes/ext-plus/world.txt
        //   initial-includes/ext-plus/zzz.txt
        //   initial-includes/brace/hello.txt
        //   initial-includes/brace/world.txt
        //   initial-includes/brace/zzz.txt
        let root: string = path.join(
            testutil.getTestTemp(),
            'find-and-match_esc-def-root',
            'brackets[a-z]',
            '+(p-1)',
            '{b-1,b-2}');

        tl.mkdirP(path.join(root, 'bracket'));
        tl.mkdirP(path.join(root, 'ext-plus'));
        tl.mkdirP(path.join(root, 'brace'));
        tl.mkdirP(path.join(root, 'initial-includes/bracket'));
        tl.mkdirP(path.join(root, 'initial-includes/ext-plus'));
        tl.mkdirP(path.join(root, 'initial-includes/brace'));
        fs.writeFileSync(path.join(root, 'bracket', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'bracket', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'ext-plus', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'ext-plus', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'ext-plus', 'zzz.txt'), '');
        fs.writeFileSync(path.join(root, 'brace', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'brace', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'brace', 'zzz.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'bracket', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'bracket', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'ext-plus', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'ext-plus', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'ext-plus', 'zzz.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'brace', 'hello.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'brace', 'world.txt'), '');
        fs.writeFileSync(path.join(root, 'initial-includes', 'brace', 'zzz.txt'), '');
        let patterns: string[] = [
            path.join('initial-includes', '**', '*.*'),
            path.join('bracket', '[a-z]ello.txt'),
            path.join('ext-plus', '+(hello|world).txt'),
            path.join('brace', '{hello,world}.txt'),
            '!' + path.join('initial-includes', 'bracket', '[a-z]ello.txt'),
            '!' + path.join('initial-includes', 'ext-plus', '+(hello|world).txt'),
            '!' + path.join('initial-includes', 'brace', '{hello,world}.txt'),
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ });
        let expected: string[] = [
            path.join(root, 'bracket', 'hello.txt'),
            path.join(root, 'ext-plus', 'hello.txt'),
            path.join(root, 'ext-plus', 'world.txt'),
            path.join(root, 'brace', 'hello.txt'),
            path.join(root, 'brace', 'world.txt'),
            path.join(root, 'initial-includes', 'bracket', 'world.txt'),
            path.join(root, 'initial-includes', 'ext-plus', 'zzz.txt'),
            path.join(root, 'initial-includes', 'brace', 'zzz.txt'),
        ];
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('applies default find options', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   hello/hello.txt
        //   world -> hello
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_applies-default-find-options');
        tl.mkdirP(path.join(root, 'hello'));
        fs.writeFileSync(path.join(root, 'hello', 'hello.txt'), '');
        testutil.createSymlinkDir(path.join(root, 'hello'), path.join(root, 'world'));
        let actual: string[] = tl.findMatch(root, path.join('**', '*'));
        let expected: string[] = [
            path.join(root, 'hello'),
            path.join(root, 'hello', 'hello.txt'),
            path.join(root, 'world'),
            path.join(root, 'world', 'hello.txt'),
        ];
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('supports custom find options', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   hello/hello.txt
        //   world -> hello
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-custom-find-options');
        tl.mkdirP(path.join(root, 'hello'));
        fs.writeFileSync(path.join(root, 'hello', 'hello.txt'), '');
        testutil.createSymlinkDir(path.join(root, 'hello'), path.join(root, 'world'));
        assert.doesNotThrow(
            () => fs.statSync(path.join(root, 'world', 'hello.txt')),
            'soft link folder should be created properly');
        let actual: string[] = tl.findMatch(root, path.join('**', '*'), <tl.FindOptions>{ });
        let expected: string[] = [
            path.join(root, 'hello'),
            path.join(root, 'hello', 'hello.txt'),
            path.join(root, 'world'),
        ];
        assert.deepEqual(actual, expected.sort());

        done();
    });

    it('default root falls back to System.DefaultWorkingDirectory', (done) => {
        this.timeout(1000);

        let originalSystemDefaultWorkingDirectory = process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'];
        try {
            // create the following layout:
            //   hello-from-system-default-working-directory.txt
            //   world.txt
            let root: string = path.join(testutil.getTestTemp(), 'find-and-match_falls-back-to-system-default-working-directory');
            tl.mkdirP(root);
            fs.writeFileSync(path.join(root, 'hello-from-system-default-working-directory.txt'), '');
            fs.writeFileSync(path.join(root, 'world.txt'), '');
            process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = root;
            let actual: string[] = tl.findMatch(null, path.join('**', '*'), <tl.FindOptions>{ });
            let expected: string[] = [
                path.join(root, 'hello-from-system-default-working-directory.txt'),
                path.join(root, 'world.txt'),
            ];
            assert.deepEqual(actual, expected.sort());
        }
        catch (err) {
            process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = originalSystemDefaultWorkingDirectory;
            throw err;
        }

        done();
    });

    it('default root falls back to cwd', (done) => {
        this.timeout(1000);

        let originalSystemDefaultWorkingDirectory = process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'];
        let originalCwd = process.cwd();
        try {
            // create the following layout:
            //   hello-from-cwd.txt
            //   world.txt
            let root: string = path.join(testutil.getTestTemp(), 'find-and-match_falls-back-to-cwd');
            tl.mkdirP(root);
            fs.writeFileSync(path.join(root, 'hello-from-cwd.txt'), '');
            fs.writeFileSync(path.join(root, 'world.txt'), '');
            delete process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'];
            process.chdir(root);
            let actual: string[] = tl.findMatch(null, path.join('**', '*'), <tl.FindOptions>{ });
            let expected: string[] = [
                path.join(root, 'hello-from-cwd.txt'),
                path.join(root, 'world.txt'),
            ];
            assert.deepEqual(actual, expected.sort());
        }
        catch (err) {
            process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = originalSystemDefaultWorkingDirectory;
            process.chdir(originalCwd);
            throw err;
        }

        done();
    });

    function assertEnsurePatternRooted(root: string, path: string, expected: string) {
        let actual: string = im._ensurePatternRooted(root, path);
        if (actual != expected) {
            throw new Error(`ensureRootedPattern on <${root}, ${path}> yields <${actual}>; expected <${expected}>`);
        }
    }

    it('ensurePatternRooted()', (done) => {
        this.timeout(1000);

        if (process.platform == 'win32') {
            // already rooted
            assertEnsurePatternRooted('D:\\', 'C:\\hello\\world', 'C:\\hello\\world');
            assertEnsurePatternRooted('D:\\', '\\hello\\world', '\\hello\\world');
            assertEnsurePatternRooted('D:\\', '\\\\hello\\world', '\\\\hello\\world');
            assertEnsurePatternRooted('D:\\', '\\\\\\hello\\\\world\\', '\\\\\\hello\\\\world\\');

            // not already rooted
            assertEnsurePatternRooted('D:\\', 'hello\\\\world\\', 'D:\\hello\\\\world\\');
            assertEnsurePatternRooted('D:/', 'hello///world//', 'D:\\hello///world//');
            assertEnsurePatternRooted('D:', 'hello///world//', 'D:hello///world//');
            assertEnsurePatternRooted('D:\\abc', 'hello///world//', 'D:\\abc\\hello///world//');
            assertEnsurePatternRooted('D:\\abc\\', 'hello///world//', 'D:\\abc\\hello///world//');
            assertEnsurePatternRooted('D:\\abc\\\\', 'hello///world//', 'D:\\abc\\hello///world//');
            assertEnsurePatternRooted('D:/abc', 'hello///world//', 'D:\\abc\\hello///world//');
            assertEnsurePatternRooted('D:/abc/', 'hello///world//', 'D:\\abc\\hello///world//');
            assertEnsurePatternRooted('D:/abc//', 'hello///world//', 'D:\\abc\\hello///world//');
            assertEnsurePatternRooted('\\\\machine\\share', 'hello///world//', '\\\\machine\\share\\hello///world//');
            assertEnsurePatternRooted('\\\\\\machine\\share', 'hello///world//', '\\\\machine\\share\\hello///world//');
            assertEnsurePatternRooted('\\\\machine\\share\\\\', 'hello///world//', '\\\\machine\\share\\hello///world//');
            assertEnsurePatternRooted('//machine/share', 'hello///world//', '\\\\machine\\share\\hello///world//');
            assertEnsurePatternRooted('///machine/share', 'hello///world//', '\\\\machine\\share\\hello///world//');
            assertEnsurePatternRooted('///machine/share//', 'hello///world//', '\\\\machine\\share\\hello///world//');
        }
        else {
            // already rooted
            assertEnsurePatternRooted('/abc', '/hello/world', '/hello/world');
            assertEnsurePatternRooted('/abc', '/hello/world', '/hello/world');
            assertEnsurePatternRooted('/abc', '//hello/world', '//hello/world');
            assertEnsurePatternRooted('/abc', '//hello/world///', '//hello/world///');

            // not already rooted
            assertEnsurePatternRooted('/abc', '\\\\machine\\share\\', '/abc/\\\\machine\\share\\');
            assertEnsurePatternRooted('/abc/', '\\\\machine\\share\\', '/abc/\\\\machine\\share\\');
            assertEnsurePatternRooted('/abc', 'hello/world', '/abc/hello/world');
            assertEnsurePatternRooted('/abc\\\\def\\', 'hello/world', '/abc\\\\\\\\def\\\\/hello/world');
            assertEnsurePatternRooted('//abc//', 'D://hello///world//', '/abc/D://hello///world//');
        }

        assertEnsurePatternRooted(
            '/abc[[def]',
            'hello',
            path.sep + 'abc[[][[]def]' + path.sep + 'hello');
        assertEnsurePatternRooted(
            '/ab??c',
            'hello',
            path.sep + 'ab[?][?]c' + path.sep + 'hello');
        assertEnsurePatternRooted(
            '/ab**c',
            'hello',
            path.sep + 'ab[*][*]c' + path.sep + 'hello');
        assertEnsurePatternRooted(
            '/ab+(+(c',
            'hello',
            path.sep + 'ab[+]([+](c' + path.sep + 'hello');
        assertEnsurePatternRooted(
            '/ab@(@(c',
            'hello',
            path.sep + 'ab[@]([@](c' + path.sep + 'hello');
        assertEnsurePatternRooted(
            '/ab!(!(c',
            'hello',
            path.sep + 'ab[!]([!](c' + path.sep + 'hello');
        assertEnsurePatternRooted(
            '/abc[?*+(@(!(def]',
            'hello',
            path.sep + 'abc[[][?][*][+]([@]([!](def]' + path.sep + 'hello');

        done();
    });

    function assertPatternFindInfo(defaultRoot: string, pattern: string, matchOptions: tl.MatchOptions, expected: any) {
        let actual: any = im._getFindInfoFromPattern(defaultRoot, pattern, matchOptions);
        assert.deepEqual(actual, expected);
    }

    it('getFindInfoFromPattern()', (done) => {
        this.timeout(1000);

        // basename
        assertPatternFindInfo(
            '/default-root',
            'hello',
            <tl.MatchOptions>{ nobrace: true },
            <any>{
                adjustedPattern: process.platform == 'win32' ? '\\default-root\\hello' : '/default-root/hello',
                findPath: process.platform == 'win32' ? '\\default-root\\hello' : '/default-root/hello',
                statOnly: true,
            });

        // relative path
        assertPatternFindInfo(
            '/default-root',
            'hello/world',
            <tl.MatchOptions>{ nobrace: true },
            <any>{
                adjustedPattern: process.platform == 'win32' ? '\\default-root\\hello/world' : '/default-root/hello/world',
                findPath: process.platform == 'win32' ? '\\default-root\\hello\\world' : '/default-root/hello/world',
                statOnly: true,
            });

        // relative path, glob
        assertPatternFindInfo(
            '/default-root',
            'hello/world*',
            <tl.MatchOptions>{ nobrace: true },
            <any>{
                adjustedPattern: process.platform == 'win32' ? '\\default-root\\hello/world*' : '/default-root/hello/world*',
                findPath: process.platform == 'win32' ? '\\default-root\\hello' : '/default-root/hello',
                statOnly: false,
            });

        // rooted path
        assertPatternFindInfo(
            '/default-root',
            '/non-default-root/hello/world',
            <tl.MatchOptions>{ nobrace: true },
            <any>{
                adjustedPattern: '/non-default-root/hello/world',
                findPath: process.platform == 'win32' ? '\\non-default-root\\hello\\world' : '/non-default-root/hello/world',
                statOnly: true,
            });

        // rooted path, glob
        assertPatternFindInfo(
            '/default-root',
            '/non-default-root/hello/world*',
            <tl.MatchOptions>{ nobrace: true },
            <any>{
                adjustedPattern: '/non-default-root/hello/world*',
                findPath: process.platform == 'win32' ? '\\non-default-root\\hello' : '/non-default-root/hello',
                statOnly: false,
            });

        // rooted path, glob, nocase: true
        assertPatternFindInfo(
            '/default-root',
            '/non-default-root/hello/world*',
            <tl.MatchOptions>{ nobrace: true, nocase: true },
            <any>{
                adjustedPattern: '/non-default-root/hello/world*',
                findPath: process.platform == 'win32' ? '\\non-default-root\\hello' : '/non-default-root/hello',
                statOnly: false,
            });

        // UNC path, glob
        assertPatternFindInfo(
            '/default-root',
            '//machine/share/hello/world*',
            <tl.MatchOptions>{ nobrace: true },
            <any>{
                adjustedPattern: '//machine/share/hello/world*',
                findPath: process.platform == 'win32' ? '\\\\machine\\share\\hello' : '/machine/share/hello',
                statOnly: false,
            });

        // backslashes
        assertPatternFindInfo(
            '/default-root',
            '\\hello\\world*',
            <tl.MatchOptions>{ nobrace: true },
            <any>{
                adjustedPattern: process.platform == 'win32' ? '\\hello\\world*' : '/default-root/\\hello\\world*',
                findPath: process.platform == 'win32' ? '\\hello' : '/default-root',
                statOnly: false,
            });

        // matchBase: true, basename
        assertPatternFindInfo(
            '/default-root',
            'hello',
            <tl.MatchOptions>{ matchBase: true, nobrace: true },
            <any>{
                adjustedPattern: 'hello',
                findPath: '/default-root',
                statOnly: false,
            });

        // matchBase: true, relative path
        assertPatternFindInfo(
            '/default-root',
            'hello/world',
            <tl.MatchOptions>{ matchBase: true, nobrace: true },
            <any>{
                adjustedPattern: process.platform == 'win32' ? '\\default-root\\hello/world' : '/default-root/hello/world',
                findPath: process.platform == 'win32' ? '\\default-root\\hello\\world' : '/default-root/hello/world',
                statOnly: true,
            });

        // matchBase: true, relative path, contains glob
        assertPatternFindInfo(
            '/default-root',
            'hello/world*',
            <tl.MatchOptions>{ matchBase: true, nobrace: true },
            <any>{
                adjustedPattern: process.platform == 'win32' ? '\\default-root\\hello/world*' : '/default-root/hello/world*',
                findPath: process.platform == 'win32' ? '\\default-root\\hello' : '/default-root/hello',
                statOnly: false,
            });

        done();
    });
});
