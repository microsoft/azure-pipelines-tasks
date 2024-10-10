// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as testutil from './testutil';
import * as im from '../_build/internal';
import * as tl from '../_build/task';

describe('Legacy Find Files Tests', function () {

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

    it('supports directory name single char wildcard', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is-1-match/file.txt
        //   is-1-match/is-not/file.txt
        //   is-2-match/file.txt
        //   is-2-match/is-not/file.txt
        //   is-not-match/file.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-dir-name-single-char-wildcard');
        tl.mkdirP(path.join(root, 'is-1-match', 'is-not'));
        tl.mkdirP(path.join(root, 'is-2-match', 'is-not'));
        tl.mkdirP(path.join(root, 'is-not-match', 'is-not'));
        fs.writeFileSync(path.join(root, 'is-1-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-1-match', 'is-not', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-2-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-2-match', 'is-not', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-not-match', 'file.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'is-?-match', 'file.txt'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'is-1-match', 'file.txt'),
                path.join(root, 'is-2-match', 'file.txt')
            ]);

        done();
    });

    it('supports directory name wildcard', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is-one-match/file.txt
        //   is-one-match/is-not/file.txt
        //   is-two-match/file.txt
        //   is-two-match/is-not/file.txt
        //   is-not/file.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-dir-name-wildcard');
        tl.mkdirP(path.join(root, 'is-one-match', 'is-not'));
        tl.mkdirP(path.join(root, 'is-two-match', 'is-not'));
        tl.mkdirP(path.join(root, 'is-not'));
        fs.writeFileSync(path.join(root, 'is-one-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-one-match', 'is-not', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-two-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-two-match', 'is-not', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-not', 'file.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'is-*-match', 'file.txt'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'is-one-match', 'file.txt'),
                path.join(root, 'is-two-match', 'file.txt')
            ]);

        done();
    });

    it('supports exclude patterns', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   level-1-dir-1/level-2-dir-1/match.txt
        //   level-1-dir-1/match.txt
        //   level-1-dir-2/level-2-dir-2/match.txt
        //   level-1-dir-2/match.txt
        //   level-1-dir-3/level-2-dir-3/match.txt
        //   level-1-dir-3/match.txt
        //   match.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-exclude-pattern');
        tl.mkdirP(path.join(root, 'level-1-dir-1', 'level-2-dir-1'));
        tl.mkdirP(path.join(root, 'level-1-dir-2', 'level-2-dir-2'));
        tl.mkdirP(path.join(root, 'level-1-dir-3', 'level-2-dir-3'));
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'level-2-dir-1', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'level-2-dir-2', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-3', 'level-2-dir-3', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-3', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'match.txt'), '');

        let actual: string[] = tl.legacyFindFiles(
            '',
            path.join(root, '**', 'match.txt')
            + ';-:' + path.join(root, '**', 'level-1-dir-2', '**')
            + ';-:' + path.join(root, 'level-1-dir-3', 'match.*'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'level-1-dir-1', 'level-2-dir-1', 'match.txt'),
                path.join(root, 'level-1-dir-1', 'match.txt'),
                path.join(root, 'level-1-dir-3', 'level-2-dir-3', 'match.txt'),
                path.join(root, 'match.txt')
            ]);

        done();
    });

    it('supports file name single char wildcard', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is-1-match.txt
        //   is-2-match.txt
        //   is-not-match.txt
        //   is-not/is-1-match.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-file-name-single-char-wildcard');
        tl.mkdirP(path.join(root, 'is-not'));
        fs.writeFileSync(path.join(root, 'is-1-match.txt'), '');
        fs.writeFileSync(path.join(root, 'is-2-match.txt'), '');
        fs.writeFileSync(path.join(root, 'is-not-match.txt'), '');
        fs.writeFileSync(path.join(root, 'is-not', 'is-1-match.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'is-?-match.txt'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'is-1-match.txt'),
                path.join(root, 'is-2-match.txt')
            ]);

        done();
    });

    it('supports file name wildcard', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is-not/is-one-match.txt
        //   is-one-match.txt
        //   is-two-match.txt
        //   non-match.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-file-name-wildcard');
        tl.mkdirP(path.join(root, 'is-not'));
        fs.writeFileSync(path.join(root, 'is-not', 'is-one-match.txt'), '');
        fs.writeFileSync(path.join(root, 'is-one-match.txt'), '');
        fs.writeFileSync(path.join(root, 'is-two-match.txt'), '');
        fs.writeFileSync(path.join(root, 'non-match.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'is-*-match.txt'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'is-one-match.txt'),
                path.join(root, 'is-two-match.txt')
            ]);

        done();
    });

    it('supports globstar', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   level-1-dir-1/level-2-dir-1/match.txt
        //   level-1-dir-1/match.txt
        //   level-1-dir-2/level-2-dir-2/match.txt
        //   level-1-dir-2/match.txt
        //   match.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-globstar');
        tl.mkdirP(path.join(root, 'level-1-dir-1', 'level-2-dir-1'));
        tl.mkdirP(path.join(root, 'level-1-dir-2', 'level-2-dir-2'));
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'level-2-dir-1', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'level-2-dir-2', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'match.txt'), '');
        fs.writeFileSync(path.join(root, 'match.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, '**', 'match.txt'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'level-1-dir-1', 'level-2-dir-1', 'match.txt'),
                path.join(root, 'level-1-dir-1', 'match.txt'),
                path.join(root, 'level-1-dir-2', 'level-2-dir-2', 'match.txt'),
                path.join(root, 'level-1-dir-2', 'match.txt'),
                path.join(root, 'match.txt')
            ]);

        done();
    });

    it('supports include directories', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is-1-match/file.txt
        //   is-2-match/file.txt
        //   is-not-match/file.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-include-directories');
        tl.mkdirP(path.join(root, 'is-1-match'));
        tl.mkdirP(path.join(root, 'is-2-match'));
        tl.mkdirP(path.join(root, 'is-not-match'));
        fs.writeFileSync(path.join(root, 'is-1-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-2-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-not-match', 'file.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'is-?-match**'), true, true);

        assert.deepEqual(
            actual,
            [
                path.join(root, 'is-1-match'),
                path.join(root, 'is-1-match', 'file.txt'),
                path.join(root, 'is-2-match'),
                path.join(root, 'is-2-match', 'file.txt')
            ]);

        done();
    });

    it('supports include directories only', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is-1-match/file.txt
        //   is-2-match/file.txt
        //   is-not-match/file.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-include-directories-only');
        tl.mkdirP(path.join(root, 'is-1-match'));
        tl.mkdirP(path.join(root, 'is-2-match'));
        tl.mkdirP(path.join(root, 'is-not-match'));
        fs.writeFileSync(path.join(root, 'is-1-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-2-match', 'file.txt'), '');
        fs.writeFileSync(path.join(root, 'is-not-match', 'file.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'is-?-match**'), false, true);

        assert.deepEqual(
            actual,
            [
                path.join(root, 'is-1-match'),
                path.join(root, 'is-2-match')
            ]);

        done();
    });

    it('supports inter-segment wildcard', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is-not-a-match.txt
        //   level-1-dir-1/is-a-match.txt
        //   level-1-dir-1/is-not.txt
        //   level-1-dir-1/level-2-dir-1/is-a-match.txt
        //   level-1-dir-1/level-2-dir-1/is-not.txt
        //   level-1-dir-2/is-a-match.txt
        //   level-1-dir-2/is-not.txt
        //   level-1-dir-2/level-2-dir-2/is-a-match.txt
        //   level-1-dir-2/level-2-dir-2/is-not.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-inter-segment-wildcard');
        tl.mkdirP(path.join(root, 'level-1-dir-1', 'level-2-dir-1'));
        tl.mkdirP(path.join(root, 'level-1-dir-2', 'level-2-dir-2'));
        fs.writeFileSync(path.join(root, 'is-not-a-match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'is-a-match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'is-not.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'level-2-dir-1', 'is-a-match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-1', 'level-2-dir-1', 'is-not.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'is-a-match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'is-not.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'level-2-dir-2', 'is-a-match.txt'), '');
        fs.writeFileSync(path.join(root, 'level-1-dir-2', 'level-2-dir-2', 'is-not.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'level**match.txt'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'level-1-dir-1', 'is-a-match.txt'),
                path.join(root, 'level-1-dir-1', 'level-2-dir-1', 'is-a-match.txt'),
                path.join(root, 'level-1-dir-2', 'is-a-match.txt'),
                path.join(root, 'level-1-dir-2', 'level-2-dir-2', 'is-a-match.txt')
            ]);

        done();
    });

    it('unions matches', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   foo-match.txt
        //   match-foo-match.txt
        //   match-foo.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-unions-matches');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'foo-match.txt'), '');
        fs.writeFileSync(path.join(root, 'match-foo-match.txt'), '');
        fs.writeFileSync(path.join(root, 'match-foo.txt'), '');

        let actual: string[] = tl.legacyFindFiles(
            '',
            `${path.join(root, 'match*.txt')};${path.join(root, '*match.txt')}`);

        assert.deepEqual(
            actual,
            [
                path.join(root, 'foo-match.txt'),
                path.join(root, 'match-foo-match.txt'),
                path.join(root, 'match-foo.txt')
            ]);

        done();
    });

    it('has platform-specific case sensitivity', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   one.txt
        //   two.Txt
        //   three.TXT
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-case-sensitivity');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'one.txt'), '');
        fs.writeFileSync(path.join(root, 'two.Txt'), '');
        fs.writeFileSync(path.join(root, 'three.TXT'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, '*.Txt'));

        if (process.platform == 'win32') {
            assert.deepEqual(
                actual,
                [
                    path.join(root, 'one.txt'),
                    path.join(root, 'three.TXT'),
                    path.join(root, 'two.Txt')
                ]);
        }
        else {
            assert.deepEqual(
                actual,
                [
                    path.join(root, 'two.Txt')
                ]);
        }

        done();
    });

    it('supports literal ; in pattern', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   is;match.txt
        //   is-not.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-literal-semicolon-in-pattern');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'is;match.txt'), '');
        fs.writeFileSync(path.join(root, 'is-not.txt'), '');

        let actual: string[] = tl.legacyFindFiles('', path.join(root, 'is;;match.???'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'is;match.txt')
            ]);

        done();
    });

    it('supports literal ; in rootDirectory', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   some;dir/is-match.txt
        //   some;dir/is-not.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-literal-semicolon-in-root-dir');
        tl.mkdirP(path.join(root, 'some;dir'));
        fs.writeFileSync(path.join(root, 'some;dir', 'is-match.txt'), '');
        fs.writeFileSync(path.join(root, 'some;dir', 'is-not.txt'), '');

        let actual: string[] = tl.legacyFindFiles(
            path.join(root, 'some;dir'), // rootDirectory
            '*match.txt'); // pattern

        assert.deepEqual(
            actual,
            [
                path.join(root, 'some;dir', 'is-match.txt')
            ]);

        done();
    });

    it('supports pattern is ;', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   ;
        //   is-not.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-pattern-is-semicolon');
        tl.mkdirP(path.join(root));
        fs.writeFileSync(path.join(root, ';'), '');
        fs.writeFileSync(path.join(root, 'is-not.txt'), '');

        let actual: string[] = tl.legacyFindFiles(root, ';;');

        assert.deepEqual(
            actual,
            [
                path.join(root, ';')
            ]);

        done();
    });

    it('does not support pattern with trailing slash', (done) => {
        this.timeout(1000);

        let pattern = path.join(__dirname, 'hello', 'world') + '/';
        try {
            tl.legacyFindFiles('', pattern);
            assert.fail('should have failed');
        }
        catch (err) {
            assert.equal(err.message, `Invalid pattern: '${pattern}'`)
            done();
        }
    });

    it('has platform-specific support for pattern with trailing backslash', (done) => {
        this.timeout(1000);

        if (process.platform == 'win32') {
            let pattern = path.join(__dirname, 'hello', 'world') + '\\';
            try {
                tl.legacyFindFiles('', pattern);
                assert.fail('should have failed');
            }
            catch (err) {
                assert.equal(err.message, `Invalid pattern: '${pattern}'`)
                done();
            }
        }
        else {
            // create the following layout:
            //   one\
            //   two\
            //   three\
            let root: string = path.join(testutil.getTestTemp(), 'legacy-find-pattern-trailing-backslash');
            tl.mkdirP(path.join(root));
            fs.writeFileSync(path.join(root, 'one\\'), '');
            fs.writeFileSync(path.join(root, 'two\\'), '');
            fs.writeFileSync(path.join(root, 'three\\'), '');

            let actual: string[] = tl.legacyFindFiles('', path.join(root, '???\\'));

            assert.deepEqual(
                actual,
                [
                    path.join(root, 'one\\'),
                    path.join(root, 'two\\')
                ]);

            done();
        }
    });

    it('follows symlink dirs', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   level-1-real-dir/level-2-file
        //   level-1-real-dir/level-2-real-dir/level-3-dir
        //   level-1-real-dir/level-2-real-dir/level-3-file
        //   level-1-real-dir/level-2-sym-dir => level-1-real-dir/level-2-real-dir
        //   level-1-sym-dir => level-1-real-dir
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-matches-symlink-dirs')
        tl.mkdirP(path.join(root, 'level-1-real-dir', 'level-2-real-dir', 'level-3-dir'));
        fs.writeFileSync(path.join(root, 'level-1-real-dir', 'level-2-file'), '');
        fs.writeFileSync(path.join(root, 'level-1-real-dir', 'level-2-real-dir', 'level-3-file'), '');
        testutil.createSymlinkDir(path.join(root, 'level-1-real-dir'), path.join(root, 'level-1-sym-dir'));
        testutil.createSymlinkDir(path.join(root, 'level-1-real-dir', 'level-2-real-dir'), path.join(root, 'level-1-real-dir', 'level-2-sym-dir'));

        let actual: string[] = tl.legacyFindFiles(
            '', // rootDirectory
            path.join(root, 'level-1-sym-dir', '**'), // pattern
            false, // includeFiles
            true); // includeDirectories

        assert.deepEqual(
            actual,
            [
                path.join(root, 'level-1-sym-dir'),
                path.join(root, 'level-1-sym-dir', 'level-2-real-dir'),
                path.join(root, 'level-1-sym-dir', 'level-2-real-dir', 'level-3-dir'),
                path.join(root, 'level-1-sym-dir', 'level-2-sym-dir'),
                path.join(root, 'level-1-sym-dir', 'level-2-sym-dir', 'level-3-dir'),
            ]);

        done();
    });

    it('supports alternate include syntax', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   one.txt
        //   two.txt
        //   three.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-alternate-include-syntax');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'one.txt'), '');
        fs.writeFileSync(path.join(root, 'two.txt'), '');
        fs.writeFileSync(path.join(root, 'three.txt'), '');

        let actual: string[] = tl.legacyFindFiles(
            '', // rootDirectory
            path.join(root, 'one.txt') // pattern
            + ';+:' + path.join(root, 'two.txt'));

        assert.deepEqual(
            actual,
            [
                path.join(root, 'one.txt'),
                path.join(root, 'two.txt')
            ]);

        done();
    });

    it('appends root directory', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   one.txt
        //   two.txt
        //   three.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-appends-root-directory');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'one.txt'), '');
        fs.writeFileSync(path.join(root, 'two.txt'), '');
        fs.writeFileSync(path.join(root, 'three.txt'), '');

        let actual: string[] = tl.legacyFindFiles(
            root, // rootDirectory
            path.join(root, 'one.txt') // rooted pattern
            + ';' + 'two.txt'); // unrooted pattern

        assert.deepEqual(
            actual,
            [
                path.join(root, 'one.txt'),
                path.join(root, 'two.txt')
            ]);

        done();
    });

    it('supports hidden files', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   .hello/.one.txt
        //   .hello/two.txt
        //   .hello/three.txt.bak
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-hidden-files');
        tl.mkdirP(root);
        testutil.createHiddenDirectory(path.join(root, '.hello'));
        testutil.createHiddenFile(path.join(root, '.hello', '.one.txt'), '');
        fs.writeFileSync(path.join(root, '.hello', 'two.txt'), '');

        let actual: string[] = tl.legacyFindFiles(
            '', // rootDirectory
            path.join(root, '*', '*.txt')); // pattern

        assert.deepEqual(
            actual,
            [
                path.join(root, '.hello', '.one.txt'),
                path.join(root, '.hello', 'two.txt')
            ]);

        done();
    });

    it('supports hidden folders', (done) => {
        this.timeout(1000);

        // create the following layout:
        //   .one/one.txt
        //   .two/.three/.four/.five/file.txt
        //   .two/.three/.four/four.txt
        //   .two/.three/three.txt
        //   .two/two.txt
        let root: string = path.join(testutil.getTestTemp(), 'legacy-find-hidden-folders');
        tl.mkdirP(root);
        testutil.createHiddenDirectory(path.join(root, '.one'));
        testutil.createHiddenDirectory(path.join(root, '.two'));
        testutil.createHiddenDirectory(path.join(root, '.two', '.three'));
        testutil.createHiddenDirectory(path.join(root, '.two', '.three', '.four'));
        testutil.createHiddenDirectory(path.join(root, '.two', '.three', '.four', '.five'));
        fs.writeFileSync(path.join(root, '.one', 'one.txt'), '');
        fs.writeFileSync(path.join(root, '.two', 'two.txt'), '');
        fs.writeFileSync(path.join(root, '.two', '.three', 'three.txt'), '');
        fs.writeFileSync(path.join(root, '.two', '.three', '.four', 'four.txt'), '');
        fs.writeFileSync(path.join(root, '.two', '.three', '.four', '.five', 'five.txt'), '');

        let actual: string[] = tl.legacyFindFiles(
            '', // rootDirectory
            path.join(root, '????') // pattern
            + ';' + path.join(root, '.two', '**'),
            false, // includeFiles
            true); // includeDirectories
        assert.deepEqual(
            actual,
            [
                path.join(root, '.one'),
                path.join(root, '.two'),
                path.join(root, '.two', '.three'),
                path.join(root, '.two', '.three', '.four'),
                path.join(root, '.two', '.three', '.four', '.five')
            ]);

        done();
    });

    function assertMatch(pattern: string, path: string): void {
        assert(im._legacyFindFiles_convertPatternToRegExp(pattern).test(path),
            `pattern '${pattern}' should match path '${path}'`);
    }

    function assertNotMatch(pattern: string, path: string): void {
        assert(!im._legacyFindFiles_convertPatternToRegExp(pattern).test(path),
            `pattern '${pattern}' should not match path '${path}'`);
    }

    it('converts patterns to RegExp', (done) => {
        let tlAny = tl as any;
        if (process.platform == 'win32') {
            // should convert to forward slashes
            assertMatch('C:\\hello\\world', 'C:/hello/world');
            assertNotMatch('C:\\hello', 'C:\\hello');

            // should be case insensitive
            assertMatch('C:\\hello', 'C:/Hello');
        }
        else {
            // should not convert slashes
            assertNotMatch('/hello\\world', '/hello/world');
            assertNotMatch('/hello/world', '/hello\\world');

            // should be case sensitive
            assertNotMatch('C:\\hello', 'C:/Hello');
        }

        // beginning and end of string
        assertMatch('/hello/world', '/hello/world');
        assertNotMatch('/hello/world', '_/hello/world');
        assertNotMatch('/hello/world', '/hello/world_');

        // basic escaping
        assertMatch('/hello/world.txt', '/hello/world.txt');
        assertNotMatch('/hello/world.txt', '/hello/world_txt');
        assertNotMatch('/hello/world.txt.bak', '/hello/world.txt_bak');

        // extra slashes not ok
        assertNotMatch('/hello/world', '/hello//world');

        // globstar
        assertMatch('/hello/**/world', '/hello/world');
        assertMatch('/hello/**/world', '/hello/one/world');
        assertMatch('/hello/**/world', '/hello/one/two/world');
        assertMatch('/hello/**/world', '/hello/one/two/three/world');
        assertMatch('/hello/**/one/**/world', '/hello/one/world');
        assertNotMatch('/hello/**/world', '/helloworld');
        assertNotMatch('/hello/**/world', '/hello_/world');
        assertNotMatch('/hello/**/world', '/hello/_world');

        // inter-segment wildcard
        assertMatch('/hello/**world', '/hello/world');
        assertMatch('/hello/**world', '/hello/_world');
        assertMatch('/hello/**world', '/hello/one/world');
        assertMatch('/hello/**world', '/hello/one/two/world');
        assertMatch('/hello/**world', '/hello/one/two/three/world');
        assertMatch('/hello/**world', '/hello/one/two/three/_world');
        assertMatch('/hello/one**two**world', '/hello/one_/_/_/_/_two_/_/_/_/_world');
        assertNotMatch('/hello/**world', '/hello');
        assertNotMatch('/hello/**world', '/hello/_');
        assertNotMatch('/hello/**world', '/hello/world_');
        assertNotMatch('/hello/**world', '/helloworld');
        assertNotMatch('/hello/**world', '/hello_/world');
        assertMatch('/hello**/world', '/hello/world');
        assertMatch('/hello**/world', '/hello_/world');
        assertMatch('/hello**/world', '/hello/one/world');
        assertMatch('/hello**/world', '/hello/one/two/world');
        assertMatch('/hello**/world', '/hello/one/two/three/world');
        assertMatch('/hello**/world', '/hello_/one/two/three/world');
        assertNotMatch('/hello**/world', '/hello');
        assertNotMatch('/hello**/world', '/hello/_');
        assertNotMatch('/hello**/world', '/hello/_world');
        assertNotMatch('/hello**/world', '/helloworld');
        assertNotMatch('/hello**/world', '/hello/world_');
        assertMatch('/hello/one**world', '/hello/one/world');
        assertMatch('/hello/one**world', '/hello/one/two/world');
        assertMatch('/hello/one**world', '/hello/one/two/three/world');
        assertMatch('/hello/one**world', '/hello/one/two/three/four/world');
        assertMatch('/hello/one**world', '/hello/one_/_world');
        assertMatch('/hello/one**world', '/hello/one_/two/_world');
        assertMatch('/hello/one**world', '/hello/one_/two/three/_world');
        assertMatch('/hello/one**world', '/hello/one_/two/three/four/_world');
        assertNotMatch('/hello/one**world', '_/hello/one/world');
        assertNotMatch('/hello/one**world', '/hello/one/world_');
        assertNotMatch('/hello/one**world', '/hello/on_/world');
        assertNotMatch('/hello/one**world', '/hello/one/_orld');

        // wildcard file name
        assertMatch('/hello/world*', '/hello/world');
        assertMatch('/hello/world*', '/hello/world__');
        assertNotMatch('/hello/world*', '/hello/worl');
        assertNotMatch('/hello/world*', '/hello/world/one');
        assertMatch('/hello/*world', '/hello/world');
        assertMatch('/hello/*world', '/hello/__world');
        assertNotMatch('/hello/*world', '/hello/one/world');
        assertNotMatch('/hello/*world', '/hello/orld');
        assertNotMatch('/hello/*world', '/helloworld');
        assertMatch('/hello/*world*', '/hello/world');
        assertMatch('/hello/*world*', '/hello/__world__');
        assertMatch('/hello/one*two', '/hello/onetwo');
        assertMatch('/hello/one*two', '/hello/one__two');
        assertNotMatch('/hello/one*two', '/hello/one/two');

        // wildcard directory name
        assertMatch('/hello/one*/world', '/hello/one/world');
        assertMatch('/hello/one*/world', '/hello/one__/world');
        assertNotMatch('/hello/one*/world', '/hello/on/world');
        assertNotMatch('/hello/one*/world', '/hello/one/two/world');
        assertMatch('/hello/*one/world', '/hello/one/world');
        assertMatch('/hello/*one/world', '/hello/__one/world');
        assertNotMatch('/hello/*one/world', '/hello/two/one/world');
        assertNotMatch('/hello/*one/world', '/hello/ne/world');
        assertNotMatch('/hello/*one/world', '/helloone/world');
        assertMatch('/hello/*one*/world', '/hello/one/world');
        assertMatch('/hello/*one*/world', '/hello/__one__/world');
        assertMatch('/hello/one*two/world', '/hello/onetwo/world');
        assertMatch('/hello/one*two/world', '/hello/one__two/world');
        assertNotMatch('/hello/one*two/world', '/hello/one/two/world');

        // single char wildcard file name
        assertMatch('/hello/world?', '/hello/world_');
        assertNotMatch('/hello/world?', '/hello/worl');
        assertNotMatch('/hello/world?', '/hello/world');
        assertNotMatch('/hello/world?', '/hello/world__');
        assertMatch('/hello/?world', '/hello/_world');
        assertNotMatch('/hello/?world', '/helloworld');
        assertNotMatch('/hello/?world', '/hello/world');
        assertNotMatch('/hello/?world', '/hello/__world');
        assertNotMatch('/hello/one?two', '/hello/one/two');

        // single char wildcard directory name
        assertMatch('/hello/one?/world', '/hello/one_/world');
        assertNotMatch('/hello/one?/world', '/hello/on/world');
        assertNotMatch('/hello/one?/world', '/hello/one/world');
        assertNotMatch('/hello/one?/world', '/hello/one__/world');
        assertMatch('/hello/?one/world', '/hello/_one/world');
        assertNotMatch('/hello/?one/world', '/helloone/world');
        assertNotMatch('/hello/?one/world', '/hello/one/world');
        assertNotMatch('/hello/?one/world', '/hello/__one/world');
        assertNotMatch('/hello/one?two/world', '/hello/one/two/world');

        done();
    });
});