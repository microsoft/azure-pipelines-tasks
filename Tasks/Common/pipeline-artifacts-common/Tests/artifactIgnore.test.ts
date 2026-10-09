import * as assert from 'assert';
import { ArtifactIgnore, ArtifactIgnoreError } from '../src/dedup/artifactIgnore';
import { readFixtureJson } from './testUtil';

interface IgnoreCase {
    id: string;
    rules: string | null;
    hasIgnoreFile: boolean;
    tree: string[];
    published: string[];
}

interface OracleFixture {
    trees: Record<string, string[]>;
    cases: Array<{ tree: string; rules: string; ignored: number[] }>;
    syntaxErrors: Array<{ rules: string; message: string }>;
}

function windows(rules: string): ArtifactIgnore {
    return ArtifactIgnore.parse(rules, true, true);
}

function linux(rules: string): ArtifactIgnore {
    return ArtifactIgnore.parse(rules, false, false);
}

function ignoredBy(matcher: ArtifactIgnore, ...paths: string[]): string[] {
    return paths.filter(candidate => matcher.ignores(candidate));
}

function onWindows(rules: string, ...paths: string[]): string[] {
    return ignoredBy(windows(rules), ...paths);
}

function onLinux(rules: string, ...paths: string[]): string[] {
    return ignoredBy(linux(rules), ...paths);
}

describe('.artifactignore', () => {
    for (const platform of [
        { name: 'Windows', fixture: 'artifactignore-windows.json', ignoreCase: true, windows: true },
        { name: 'Linux', fixture: 'artifactignore-linux.json', ignoreCase: false, windows: false }
    ]) {
        describe(`the files the agent plugin published for the same rules (${platform.name})`, () => {
            const fixture = readFixtureJson<{ cases: IgnoreCase[] }>(platform.fixture);
            for (const testCase of fixture.cases) {
                it(`${testCase.id}: ${JSON.stringify(testCase.rules)}`, () => {
                    const matcher = ArtifactIgnore.parse(testCase.hasIgnoreFile ? testCase.rules ?? '' : undefined, platform.ignoreCase, platform.windows);
                    const published = testCase.tree.filter(file => !matcher.ignores(file));
                    assert.deepStrictEqual([...published].sort(), [...testCase.published].sort());
                });
            }
        });
    }

    for (const platform of [
        { name: 'Windows', fixture: 'artifactignore-oracle-windows.json', windows: true },
        { name: 'Linux', fixture: 'artifactignore-oracle-linux.json', windows: false }
    ]) {
        describe(`generated rule sets that the agent plugin code was run on (${platform.name})`, () => {
            const fixture = readFixtureJson<OracleFixture>(platform.fixture);

            it(`ignores the same files in ${fixture.cases.length} rule sets`, () => {
                const different: string[] = [];
                for (const testCase of fixture.cases) {
                    const tree = fixture.trees[testCase.tree];
                    const matcher = ArtifactIgnore.parse(testCase.rules, platform.windows, platform.windows);
                    const ignored = tree.map((_, index) => index).filter(index => matcher.ignores(tree[index]));
                    if (ignored.join() !== testCase.ignored.join()) {
                        different.push(`${JSON.stringify(testCase.rules)}: expected ${testCase.ignored.map(i => tree[i]).join(' ')} but got ${ignored.map(i => tree[i]).join(' ')}`);
                    }
                }
                assert.deepStrictEqual(different, []);
            });

            it('refuses the rules the plugin refuses, with the same message', () => {
                assert.ok(fixture.syntaxErrors.length > 0);
                for (const testCase of fixture.syntaxErrors) {
                    assert.throws(
                        () => ArtifactIgnore.parse(testCase.rules, platform.windows, platform.windows),
                        (error: Error) => error instanceof ArtifactIgnoreError && error.message === testCase.message,
                        JSON.stringify(testCase.rules));
                }
            });
        });
    }

    describe('syntax', () => {
        it('skips empty lines and comments and accepts CRLF line endings and a byte order mark', () => {
            assert.deepStrictEqual(onWindows('# comment\n\n*.bak\r\n', 'a.bak', '# comment'), ['a.bak']);
            assert.deepStrictEqual(onWindows('\uFEFF*.tmp\n', 'a.tmp'), ['a.tmp']);
            assert.deepStrictEqual(onLinux('\uFEFF*.tmp\n', 'a.tmp'), ['a.tmp']);
        });

        it('ends a line with CRLF, CR or LF and with nothing else', () => {
            assert.deepStrictEqual(onWindows('a.tmp\rb.tmp\r\nc.tmp\nd.tmp', 'a.tmp', 'b.tmp', 'c.tmp', 'd.tmp', 'e.tmp'), ['a.tmp', 'b.tmp', 'c.tmp', 'd.tmp']);
            assert.throws(() => windows('a.tmp\fb.tmp'), ArtifactIgnoreError);
            assert.throws(() => windows('a.tmp\u2028b.tmp'), ArtifactIgnoreError);
        });

        it('only treats a line as a comment when it starts with #', () => {
            // " #a" is an ordinary rule here: it ignores a file that is called " #a" (and "a#b" a file called "a#b").
            assert.deepStrictEqual(onWindows(' #a\nb.tmp', 'b.tmp', ' #a', '#a'), ['b.tmp', ' #a']);
            assert.deepStrictEqual(onWindows('a#b', 'a#b', 'a'), ['a#b']);
        });

        it('has no escape character: "\\#" is a rule that starts with a separator', () => {
            // On Windows the separator is "\", so the rules are anchored at the root; elsewhere they match nothing.
            assert.deepStrictEqual(onWindows('\\#hash.txt\n\\!bang.txt', '#hash.txt', '!bang.txt', 'x.txt', 'sub/#hash.txt'), ['#hash.txt', '!bang.txt']);
            assert.deepStrictEqual(onLinux('\\#hash.txt\n\\!bang.txt', '#hash.txt', '!bang.txt', 'x.txt'), []);
        });

        it('does not trim rules: spaces belong to the rule', () => {
            assert.deepStrictEqual(onWindows('*.tmp   ', 'a.tmp'), []);
            assert.deepStrictEqual(onWindows('  *.tmp', 'a.tmp'), []);
        });

        it('ignores a file that matches a rule unless it matches a negation, whatever the order of the lines', () => {
            assert.deepStrictEqual(onWindows('**/*\n!b.txt', 'a.txt', 'b.txt', 'sub/b.txt'), ['a.txt']);
            assert.deepStrictEqual(onWindows('*.txt\n!sub/', 'a.txt', 'sub/b.txt'), ['a.txt']);
            assert.deepStrictEqual(onWindows('!a.txt', 'a.txt'), []);
            assert.deepStrictEqual(onWindows('a.txt\n!a.txt', 'a.txt'), []);
            // A negation also wins when it comes first, or when the rule is repeated after it.
            assert.deepStrictEqual(onWindows('!b.txt\n**/*', 'a.txt', 'b.txt', 'sub/b.txt'), ['a.txt']);
            assert.deepStrictEqual(onWindows('a.txt\n!a.txt\na.txt', 'a.txt'), []);
            assert.deepStrictEqual(onLinux('!a.txt\na.txt\n!a.txt', 'a.txt'), []);
        });

        it('does not repeat a trailing separator before the "**" of the pattern for a directory, and keeps double separators', () => {
            assert.deepStrictEqual(onWindows('sub/', 'sub/a.tmp', 'xsub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onWindows('sub//', 'sub/a.tmp'), []);
            assert.deepStrictEqual(onLinux('sub//', 'sub/a.tmp'), []);
            assert.deepStrictEqual(onWindows('a*//', 'a.tmp', 'ab/c.tmp'), []);
            // Only "/" is a separator at the end of a rule on Linux, while Windows knows both.
            assert.deepStrictEqual(onLinux('sub\\', 'sub/a.tmp'), []);
            assert.deepStrictEqual(onWindows('sub\\', 'sub/a.tmp', 'zsub/a.tmp'), ['sub/a.tmp']);
        });

        it('never matches rules that start with "./" or with the separator that is not the one of the platform', () => {
            assert.deepStrictEqual(onWindows('/a.tmp\n./b.tmp', 'a.tmp', 'sub/a.tmp', 'b.tmp'), []);
            assert.deepStrictEqual(onLinux('\\a.tmp\n./b.tmp', 'a.tmp', 'sub/a.tmp', 'b.tmp'), []);
        });

        it('anchors rules with the separator of the platform at the root of the published directory', () => {
            assert.deepStrictEqual(onWindows('sub\\a.tmp', 'sub/a.tmp', 'other/sub/a.tmp', 'zsub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onWindows('\\sub\\a.tmp', 'sub/a.tmp', 'other/sub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onWindows('sub\\*.tmp', 'sub/a.tmp', 'sub/deep/a.tmp', 'x/sub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onWindows('sub\\', 'sub/a.tmp', 'other/sub/a.tmp'), ['sub/a.tmp']);

            assert.deepStrictEqual(onLinux('sub/a.tmp', 'sub/a.tmp', 'other/sub/a.tmp', 'zsub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onLinux('/sub/a.tmp', 'sub/a.tmp', 'other/sub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onLinux('sub/*.tmp', 'sub/a.tmp', 'sub/deep/a.tmp', 'x/sub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onLinux('sub/', 'sub/a.tmp', 'other/sub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onLinux('node_modules/', 'node_modules/p/i.js', 'sub/node_modules/q/j.js'), ['node_modules/p/i.js']);
            assert.deepStrictEqual(onLinux('*/a.tmp', 'a.tmp', 'sub/a.tmp', 'sub/deep/a.tmp'), ['sub/a.tmp']);
        });

        it('lets rules with the other separator match at any depth', () => {
            assert.deepStrictEqual(onWindows('sub/a.tmp', 'sub/a.tmp', 'zsub/a.tmp', 'other/sub/a.tmp', 'sub/xa.tmp'), ['sub/a.tmp', 'zsub/a.tmp', 'other/sub/a.tmp']);
            assert.deepStrictEqual(onLinux('sub\\a.tmp', 'sub/a.tmp', 'zsub/a.tmp', 'other/sub/a.tmp', 'sub/xa.tmp'), ['sub/a.tmp', 'zsub/a.tmp', 'other/sub/a.tmp']);
            // A trailing backslash is only removed on Windows.
            assert.deepStrictEqual(onLinux('sub\\deep\\', 'sub/deep/a.tmp'), []);
        });

        it('treats a rule that is only the separator as the root: everything', () => {
            assert.deepStrictEqual(onLinux('/', 'a.tmp', 'sub/b.txt'), ['a.tmp', 'sub/b.txt']);
            assert.deepStrictEqual(onWindows('/', 'a.tmp', 'sub/b.txt'), []);
        });
    });

    describe('matching', () => {
        it('matches rules without * at the end of the path and without a boundary on the left', () => {
            assert.deepStrictEqual(onWindows('a.tmp', 'a.tmp', 'xa.tmp', 'sub/a.tmp', 'sub/xa.tmp', 'a.tmp.bak'), ['a.tmp', 'xa.tmp', 'sub/a.tmp', 'sub/xa.tmp']);
            assert.deepStrictEqual(onLinux('a.tmp', 'a.tmp', 'xa.tmp', 'sub/a.tmp', 'sub/xa.tmp', 'a.tmp.bak'), ['a.tmp', 'xa.tmp', 'sub/a.tmp', 'sub/xa.tmp']);
            assert.deepStrictEqual(onWindows('[abc].txt', 'b.txt', 'ab.txt', 'a.txt.bak'), ['b.txt', 'ab.txt']);
        });

        it('matches everything below a directory that a rule matches', () => {
            assert.deepStrictEqual(onWindows('sub', 'sub/a.tmp', 'other/sub/deep/a.tmp', 'sub2/a.tmp'), ['sub/a.tmp', 'other/sub/deep/a.tmp']);
            assert.deepStrictEqual(onWindows('sub/', 'sub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onWindows('a.tmp/', 'a.tmp'), ['a.tmp']);
        });

        it('keeps a boundary on the left for rules with * unless they start with *', () => {
            assert.deepStrictEqual(onWindows('sub/*', 'sub/a.tmp', 'zsub/a.tmp', 'other/sub/a.tmp', 'sub/deep/a.tmp'), ['sub/a.tmp', 'other/sub/a.tmp']);
            assert.deepStrictEqual(onWindows('**/a.tmp', 'xa.tmp', 'sub/a.tmp'), ['xa.tmp', 'sub/a.tmp']);
            assert.deepStrictEqual(onWindows('*/a.tmp', 'a.tmp', 'xa.tmp', 'sub/a.tmp'), ['a.tmp', 'sub/a.tmp']);
            assert.deepStrictEqual(onWindows('.*', '.hidden.tmp', 'b.txt'), ['.hidden.tmp']);
        });

        it('matches a directory by its whole name only, while files are matched by the end of their path', () => {
            assert.deepStrictEqual(onWindows('deep', 'deep/a.tmp', 'sub/deep/a.tmp', 'xdeep/a.tmp', 'sub/deepx/a.tmp', 'xdeep'), ['deep/a.tmp', 'sub/deep/a.tmp', 'xdeep']);
            assert.deepStrictEqual(onWindows('*.tmp\n!sub/', 'sub/a.tmp', 'xsub/a.tmp'), ['xsub/a.tmp']);
        });

        it('drops a leading **/ before it decides how a rule is matched, also when it would be anchored', () => {
            assert.deepStrictEqual(onWindows('**/sub', 'sub/a.tmp', 'xsub/a.tmp'), ['sub/a.tmp']);
            assert.deepStrictEqual(onWindows('**/deep/**', 'deep/a.tmp', 'xdeep/a.tmp'), ['deep/a.tmp']);
            assert.deepStrictEqual(onLinux('**/deep/**', 'deep/a.tmp', 'sub/deep/a.tmp', 'xdeep/a.tmp'), ['deep/a.tmp', 'sub/deep/a.tmp']);
            assert.deepStrictEqual(onWindows('**/a.tmp', 'xa.tmp', 'sub/a.tmp'), ['xa.tmp', 'sub/a.tmp']);
        });

        it('never lets a character class match a separator', () => {
            assert.deepStrictEqual(onWindows('[!a]b.tmp', 'b.tmp', 'xb.tmp', 'ab.tmp', 'ydeep/b.tmp'), ['xb.tmp']);
            assert.deepStrictEqual(onWindows('[a-b].tmp', 'a.tmp', 'b.tmp', 'c.tmp'), ['a.tmp', 'b.tmp']);
        });

        it('does not match everything below a directory for rules that end with *', () => {
            assert.deepStrictEqual(onWindows('sub*', 'sub/a.tmp', 'sub2/a.tmp'), []);
            assert.deepStrictEqual(onWindows('*sub', 'sub/a.tmp', 'zsub/a.tmp', 'sub2/a.tmp'), ['sub/a.tmp', 'zsub/a.tmp']);
        });

        it('lets * stop at a separator and ** cross it', () => {
            assert.deepStrictEqual(onWindows('sub/deep/*.tmp', 'sub/deep/a.tmp', 'sub/deep/x/a.tmp'), ['sub/deep/a.tmp']);
            assert.deepStrictEqual(onWindows('sub/**/a.tmp', 'sub/a.tmp', 'sub/xa.tmp', 'sub/deep/a.tmp', 'zsub/a.tmp'), ['sub/a.tmp', 'sub/xa.tmp', 'sub/deep/a.tmp']);
        });

        it('compares case insensitively when asked to', () => {
            assert.deepStrictEqual(onWindows('*.TMP', 'a.tmp', 'B.Tmp'), ['a.tmp', 'B.Tmp']);
            assert.deepStrictEqual(onLinux('*.TMP', 'a.tmp', 'B.TMP'), ['B.TMP']);
        });

        it('treats characters that are special in regular expressions literally', () => {
            assert.deepStrictEqual(onWindows('a=b.tmp', 'a=b.tmp', 'aXb.tmp'), ['a=b.tmp']);
            assert.deepStrictEqual(onWindows('a.tmp', 'a.tmp', 'aXtmp'), ['a.tmp']);
            assert.deepStrictEqual(onWindows('a-b;c@d~e.tmp', 'a-b;c@d~e.tmp', 'a-b;c@d~eXtmp'), ['a-b;c@d~e.tmp']);
        });
    });

    describe('default rule', () => {
        it('ignores .git when there is no .artifactignore file', () => {
            const matcher = ArtifactIgnore.parse(undefined, true, true);
            assert.deepStrictEqual(ignoredBy(matcher, '.git/HEAD', 'sub/.git/HEAD', 'mod/.git', '.gitx/file.txt', 'my.git/f.txt', 'file.git', 'a.txt'), ['.git/HEAD', 'sub/.git/HEAD', 'mod/.git', 'file.git']);
        });

        it('is replaced by an .artifactignore file, even an empty one', () => {
            assert.strictEqual(windows('').ignores('.git/HEAD'), false);
        });
    });

    describe('directories', () => {
        it('knows when a whole directory is ignored without looking at its files', () => {
            assert.strictEqual(windows('node_modules/').ignoresWholeDirectory('node_modules'), true);
            assert.strictEqual(windows('node_modules/').ignoresWholeDirectory('sub/node_modules'), true);
            assert.strictEqual(linux('node_modules/').ignoresWholeDirectory('sub/node_modules'), false);
            assert.strictEqual(windows('*.tmp').ignoresWholeDirectory('sub'), false);
            // A rule that ends with * never covers the files below a directory.
            assert.strictEqual(windows('sub*').ignoresWholeDirectory('sub'), false);
            // A directory is matched by its whole name, even if a file with that ending would be matched too.
            assert.strictEqual(windows('deep').ignoresWholeDirectory('xdeep'), false);
            assert.strictEqual(windows('deep').ignoresWholeDirectory('a/deep'), true);
            // With a negation a file below the directory could be re-included.
            assert.strictEqual(windows('sub\n!sub/keep.txt').ignoresWholeDirectory('sub'), false);
            assert.strictEqual(ArtifactIgnore.parse(undefined, true, true).ignoresWholeDirectory('.git'), true);
        });

        it('only skips directories for rules without wildcards, and never because a child of the directory happens to match', () => {
            // "**/a/x" matches a child called x of a directory a, but not what is below the other children of a.
            assert.strictEqual(windows('**/a/x').ignoresWholeDirectory('a'), false);
            assert.strictEqual(windows('d/x').ignoresWholeDirectory('d'), false);
            assert.strictEqual(windows('**/xs/?').ignoresWholeDirectory('xs'), false);
            assert.strictEqual(windows('*\\e\\?\\').ignoresWholeDirectory('d/e'), false);
            assert.strictEqual(windows('**/node_modules/**').ignoresWholeDirectory('a/node_modules'), false);
            assert.strictEqual(windows('node_modules').ignoresWholeDirectory('a/node_modules'), true);
            assert.strictEqual(windows('**/node_modules').ignoresWholeDirectory('a/node_modules'), true);
            assert.strictEqual(linux('/build/out').ignoresWholeDirectory('build/out'), true);
            assert.strictEqual(linux('/build/out').ignoresWholeDirectory('x/build/out'), false);
        });
    });

    describe('validation', () => {
        it('refuses the characters the plugin refuses, with the same message', () => {
            for (const character of '"$%&\'()+,<>]^`{|}') {
                assert.throws(
                    () => windows(`a${character}b`),
                    (error: Error) => error instanceof ArtifactIgnoreError && error.message === `${character} is not a supported character for a pattern.`,
                    character);
            }
        });

        it('accepts the other characters', () => {
            for (const character of '!#-:;=@_~ \u00e9\u6587') {
                assert.doesNotThrow(() => windows(`a${character}b`), character);
            }
            assert.doesNotThrow(() => windows('**/dir/*.t?[a-c]\\x/y'));
        });

        it('does not check the content of a character class, comments or what is left of an unclosed class', () => {
            for (const accepted of ['[abc].txt', 'a[^b]c', 'a[+]c', 'a[{]c', 'a[(]c', 'a[[]c', 'a[]]c', 'a[]b', 'a[b', 'a[b+c']) {
                assert.doesNotThrow(() => windows(accepted), accepted);
            }
            assert.throws(() => windows('a]b'), ArtifactIgnoreError);
            assert.doesNotThrow(() => windows('# comment with $ + ( ) { } | ^ " \' % & , < > ` ]\n*.tmp'));
        });

        it('checks negated rules, escaped characters, tabs and characters outside of the basic multilingual plane', () => {
            assert.throws(() => windows('!a+b'), /\+ is not a supported character/);
            assert.throws(() => windows('a\\+b'), /\+ is not a supported character/);
            assert.throws(() => windows('a\tb'), /is not a supported character/);
            assert.throws(() => windows('a\u{1F600}b'), /is not a supported character/);
        });
    });

    describe('limits', () => {
        it('refuses rules that are extremely long or not valid, and accepts long ones', () => {
            assert.doesNotThrow(() => windows('a'.repeat(3000)));
            assert.throws(() => windows('a'.repeat(20000)), /is too long/);
            // The plugin fails with "Index was outside the bounds of the array." for a character range without an end.
            assert.throws(() => windows('a[b-]c'), /is not valid/);
            assert.throws(() => linux('a[1-]c'), /is not valid/);
        });

        it('fails instead of taking exponential time for rules with many wildcards on long paths', () => {
            const matcher = windows('*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*b');
            const started = Date.now();
            assert.throws(() => matcher.ignores('a'.repeat(2000)), /is too complex/);
            assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
        });

        it('fails with an error, not with a stack overflow, for rules with thousands of wildcards', () => {
            const rule = '*a'.repeat(8000);
            let failure: Error | undefined;
            try {
                windows(rule).ignores('a/b');
            } catch (error) {
                failure = error as Error;
            }
            assert.ok(failure === undefined || failure instanceof ArtifactIgnoreError, String(failure));
        });
    });

    describe('rules that the plugin cannot evaluate', () => {
        it('applies the pattern where it can be evaluated, once warns about the rest, and never fails', () => {
            // The plugin stops the whole publishing with "Index was outside the bounds of the array." for a wildcard before
            // a trailing separator (as soon as there is a directory that the rule matches).
            const warnings: string[] = [];
            const matcher = ArtifactIgnore.parse('a*/', false, false, warning => warnings.push(warning));
            assert.deepStrictEqual(ignoredBy(matcher, 'ab/a.tmp', 'a/b.tmp', 'xab/a.tmp', 'a.tmp', 'd/e/a.tmp'), ['ab/a.tmp', 'a/b.tmp']);
            assert.strictEqual(warnings.length, 1);
            assert.match(warnings[0], /'a\*\/' cannot be evaluated for some paths/);
        });
    });

    describe('the directories above the published directory', () => {
        it('are not part of the paths that the rules are applied to', () => {
            // The plugin ignores everything when a rule matches a name above the published directory (".../work/1/s" with a
            // rule "work"), so the result depends on where the agent keeps its files. The paths here are rooted in a neutral
            // directory instead.
            assert.deepStrictEqual(onLinux('work\nhome\n_work\ns\n1\nvsts\nagent\n[0-9]', 'a.tmp', 'sub/b.tmp'), []);
            assert.deepStrictEqual(onWindows('Users\nagent\n_work\ns\n1\n[0-9]', 'a.tmp', 'sub/b.tmp'), []);
        });
    });
});
