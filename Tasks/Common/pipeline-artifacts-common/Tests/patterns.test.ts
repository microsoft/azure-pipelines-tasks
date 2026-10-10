import * as assert from 'assert';
import { matchAnyPattern } from '../src/util/patterns';
import { readFixtureJson } from './testUtil';

interface PatternCase {
    id: string;
    patterns: string[];
    expected: string[];
}

describe('patterns of downloads from the dedup store', () => {
    describe('the items the agent plugin restored for the same patterns (Windows)', () => {
        const fixture = readFixtureJson<{ ignoreCase: boolean; paths: string[]; cases: PatternCase[] }>('patterns-windows.json');
        for (const testCase of fixture.cases) {
            it(`${testCase.id}: ${JSON.stringify(testCase.patterns)}`, () => {
                const selected = matchAnyPattern(fixture.paths, testCase.patterns, { dot: true, nobrace: true, nocase: fixture.ignoreCase });
                assert.deepStrictEqual([...selected].sort(), [...testCase.expected].sort());
            });
        }
    });

    it('evaluates every pattern on its own and selects an item when any pattern accepts it', () => {
        const paths = ['a.txt', 'b.log', 'sub/c.txt'];
        assert.deepStrictEqual(matchAnyPattern(paths, ['**/*.txt']), ['a.txt', 'sub/c.txt']);
        // "!" accepts what the rest of the pattern does not match, so an exclusion after an inclusion selects everything.
        assert.deepStrictEqual(matchAnyPattern(paths, ['**/*.txt', '!**/c.txt']), paths);
        assert.deepStrictEqual(matchAnyPattern(paths, ['!**/*.txt']), ['b.log']);
        assert.deepStrictEqual(matchAnyPattern(paths, ['!!a.txt']), ['a.txt']);
    });

    it('ignores empty patterns and comments', () => {
        const paths = ['a.txt', 'b.log'];
        assert.deepStrictEqual(matchAnyPattern(paths, ['', '   ', '#a.txt', 'b.log']), ['b.log']);
        assert.deepStrictEqual(matchAnyPattern(paths, ['']), []);
    });
});
