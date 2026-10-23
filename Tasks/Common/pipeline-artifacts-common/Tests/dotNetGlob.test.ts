import * as assert from 'assert';
import { DotNetGlob, GlobComplexityError, GlobIndexError, GlobSyntaxError } from '../src/dedup/dotNetGlob';
import { readFixtureJson } from './testUtil';

// [pattern, text, case insensitive, 1 | 0 | "parse:message" | "eval:message"]
type Vector = [string, string, 0 | 1, 0 | 1 | string];

function evaluate(pattern: string, text: string, caseInsensitive = false): boolean {
    return DotNetGlob.parse(pattern, { caseInsensitive }).isMatch(text);
}

describe('DotNetGlob (port of DotNet.Glob 2.0.3)', () => {
    describe('results of the library that the agent plugin uses', () => {
        const fixture = readFixtureJson<{ vectors: Vector[] }>('dotnetglob-vectors.json');

        it(`gives the same result for ${fixture.vectors.length} generated patterns and texts`, () => {
            const different: string[] = [];
            for (const [pattern, text, caseInsensitive, expected] of fixture.vectors) {
                let actual: string | number;
                try {
                    const glob = DotNetGlob.parse(pattern, { caseInsensitive: caseInsensitive === 1 });
                    try {
                        actual = glob.isMatch(text) ? 1 : 0;
                    } catch (error) {
                        actual = `eval:${(error as Error).message}`;
                    }
                } catch (error) {
                    actual = `parse:${(error as Error).message}`;
                }
                if (actual !== expected) {
                    different.push(`${JSON.stringify(pattern)} on ${JSON.stringify(text)} (${caseInsensitive ? 'ignore case' : 'case'}): expected ${expected} but got ${actual}`);
                }
            }
            assert.deepStrictEqual(different, []);
        });
    });

    describe('matching', () => {
        it('matches the whole text, with * inside of one path segment and ** across segments', () => {
            assert.strictEqual(evaluate('a*c', 'abc'), true);
            assert.strictEqual(evaluate('a*c', 'ab/c'), false);
            assert.strictEqual(evaluate('a**c', 'ab/c'), true);
            assert.strictEqual(evaluate('**/b', 'a/b'), true);
            assert.strictEqual(evaluate('**/b', 'b'), true);
            assert.strictEqual(evaluate('a/**/b', 'a/x/b'), true);
        });

        it('treats "/" and "\\" as the same separator', () => {
            assert.strictEqual(evaluate('a/b', 'a\\b'), true);
            assert.strictEqual(evaluate('a\\b', 'a/b'), true);
            assert.strictEqual(evaluate('**\\b', 'x/y\\b'), true);
        });

        it('does not let ? match a separator, but lets a negated character list match one', () => {
            assert.strictEqual(evaluate('a?b', 'a/b'), false);
            assert.strictEqual(evaluate('a[!x]b', 'a/b'), true);
            assert.strictEqual(evaluate('a[x]b', 'axb'), true);
            assert.strictEqual(evaluate('[a-c]x', 'bx'), true);
            assert.strictEqual(evaluate('[0-9]x', '5x'), true);
            assert.strictEqual(evaluate('[!0-9]x', '5x'), false);
        });

        it('compares case insensitively when asked to', () => {
            assert.strictEqual(evaluate('ABC', 'abc'), false);
            assert.strictEqual(evaluate('ABC', 'abc', true), true);
            assert.strictEqual(evaluate('[A-C]x', 'bx', true), true);
            assert.strictEqual(evaluate('[A-C]x', 'bx'), false);
        });

        it('uses the case mapping of .NET, not the one of JavaScript, for the letters where they differ', () => {
            assert.strictEqual(evaluate('I', '\u0131', true), false);     // dotless i stays as it is in .NET
            assert.strictEqual(evaluate('\u0131', '\u0131', true), true);
            assert.strictEqual(evaluate('\u1F88', '\u1F80', true), true); // simple mapping, not "\u1F08\u0399"
            assert.strictEqual(evaluate('\u00e9', '\u00c9', true), true);
            assert.strictEqual(evaluate('\u00df', 'SS', true), false);    // no full case mapping
        });
    });

    describe('errors', () => {
        it('refuses characters that are neither letters, digits nor one of ". !#-;=@~_:" and the space', () => {
            for (const character of '"$%&\'()+,<>^`{|}\t') {
                assert.throws(() => DotNetGlob.parse(`a${character}b`), (error: Error) => error instanceof GlobSyntaxError && error.message === `${character} is not a supported character for a pattern.`, JSON.stringify(character));
            }
            for (const character of '.!#-;=@~_: \u00e9\u6587') {
                assert.doesNotThrow(() => DotNetGlob.parse(`a${character}b`), JSON.stringify(character));
            }
            assert.throws(() => DotNetGlob.parse('a]b'), GlobSyntaxError);
        });

        it('fails to parse a character range without an end, as the library does', () => {
            assert.throws(() => DotNetGlob.parse('a[b-]c'), (error: Error) => error instanceof GlobIndexError && error.message === 'Index was outside the bounds of the array.');
        });

        it('reads outside of the text for a wildcard before a separator at the end (the library fails there)', () => {
            assert.throws(() => DotNetGlob.parse('**/a*/**', { caseInsensitive: true }).isMatch('C:\\0\\1\\ab'), GlobIndexError);
        });

        it('limits the work that matching takes', () => {
            const glob = DotNetGlob.parse('*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*b');
            assert.throws(() => glob.isMatch('a'.repeat(300)), GlobComplexityError);
        });
    });
});
