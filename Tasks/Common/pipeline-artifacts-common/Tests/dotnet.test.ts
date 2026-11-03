import * as assert from 'assert';
import { EMPTY_GUID, isDotNetWhiteSpace, isNullOrWhiteSpace, parseDotNetBoolean, parseDotNetGuid, parseDotNetInt32, requireProjectGuid, trimDotNet } from '../src/util/dotnet';
import { JsonStringMapError, readJsonStringMap } from '../src/util/jsonStringMap';
import { readFixtureJson } from './testUtil';

interface ParseVectors {
    whitespace: number[];
    guidLeading: number[];
    guidTrailing: number[];
    intLeading: number[];
    intTrailing: number[];
    boolLeading: number[];
    boolTrailing: number[];
    int32: Array<{ input: string; value: number | null }>;
    guid: Array<{ input: string; value: string | null }>;
    bool: Array<{ input: string; value: boolean | null }>;
    properties: Array<{ input: string; status: 'ok' | 'error' | 'null'; pairs?: Array<[string, string | null]> }>;
}

function isStrictJson(text: string): boolean {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

describe('parsing like the agent plugins (.NET)', () => {
    const vectors = readFixtureJson<ParseVectors>('dotnet-parse-vectors.json');

    it('reads integers like int.TryParse', () => {
        assert.ok(vectors.int32.length > 50);
        for (const { input, value } of vectors.int32) {
            assert.strictEqual(parseDotNetInt32(input), value ?? undefined, JSON.stringify(input));
        }
        assert.strictEqual(parseDotNetInt32(undefined), undefined);
        assert.ok(Object.is(parseDotNetInt32('-0'), 0));
    });

    it('reads GUIDs like Guid.TryParse, except for the hexadecimal format', () => {
        assert.ok(vectors.guid.length > 40);
        for (const { input, value } of vectors.guid) {
            const hexadecimalFormat = /^\{0x/i.test(input.replace(/\s/g, ''));
            assert.strictEqual(parseDotNetGuid(input), hexadecimalFormat ? undefined : value ?? undefined, JSON.stringify(input));
        }
        assert.strictEqual(parseDotNetGuid(undefined), undefined);
        assert.strictEqual(parseDotNetGuid('{0F8FAD5B-D9CB-469F-A165-70867728950E}'), '0f8fad5b-d9cb-469f-a165-70867728950e');
    });

    it('knows the white space of .NET for every UTF-16 code unit: it is not the white space of JavaScript', () => {
        const whitespace = new Set(vectors.whitespace);
        assert.strictEqual(whitespace.size, 25);
        for (let code = 0; code <= 0xffff; code++) {
            assert.strictEqual(isDotNetWhiteSpace(code), whitespace.has(code), `U+${code.toString(16).padStart(4, '0')}`);
            assert.strictEqual(isNullOrWhiteSpace(String.fromCharCode(code)), whitespace.has(code), `U+${code.toString(16).padStart(4, '0')}`);
        }
        assert.ok(isNullOrWhiteSpace('\u0085') && '\u0085'.trim() !== '', 'U+0085 is white space in .NET and not in JavaScript');
        assert.ok(!isNullOrWhiteSpace('\ufeff') && '\ufeff'.trim() === '', 'U+FEFF is white space in JavaScript and not in .NET');
        assert.ok(isNullOrWhiteSpace(undefined) && isNullOrWhiteSpace('') && isNullOrWhiteSpace(' \t\r\n\u00a0\u2003\u3000'));
        assert.ok(!isNullOrWhiteSpace(' a ') && !isNullOrWhiteSpace('\u0000'));
    });

    it('trims a GUID and a number like .NET for every UTF-16 code unit', () => {
        const guid = '0f8fad5b-d9cb-469f-a165-70867728950e';
        const guidLeading = new Set(vectors.guidLeading);
        const guidTrailing = new Set(vectors.guidTrailing);
        const intLeading = new Set(vectors.intLeading);
        const intTrailing = new Set(vectors.intTrailing);
        for (let code = 0; code <= 0xffff; code++) {
            const unit = String.fromCharCode(code);
            const label = `U+${code.toString(16).padStart(4, '0')}`;
            assert.strictEqual(parseDotNetGuid(unit + guid) === guid, guidLeading.has(code), `GUID after ${label}`);
            assert.strictEqual(parseDotNetGuid(guid + unit) === guid, guidTrailing.has(code), `GUID before ${label}`);
            assert.strictEqual(parseDotNetInt32(unit + '8') !== undefined, intLeading.has(code), `number after ${label}`);
            assert.strictEqual(parseDotNetInt32('8' + unit) !== undefined, intTrailing.has(code), `number before ${label}`);
        }
    });

    it('requires the project id of the current run to be a GUID that is not all zeros, like Guid.Parse and ArgUtil.NotEmpty', () => {
        assert.strictEqual(requireProjectGuid('{0F8FAD5B-D9CB-469F-A165-70867728950E}'), '0f8fad5b-d9cb-469f-a165-70867728950e');
        assert.strictEqual(requireProjectGuid(' 11111111111111111111111111111111 '), '11111111-1111-1111-1111-111111111111');
        assert.strictEqual(EMPTY_GUID, '00000000-0000-0000-0000-000000000000');
        for (const bad of ['not-a-guid', '', '00000000-0000-0000-0000-000000000000', '{00000000000000000000000000000000}', '\ufeff0f8fad5b-d9cb-469f-a165-70867728950e']) {
            assert.throws(() => requireProjectGuid(bad), /is not a valid GUID/, bad);
        }
        assert.strictEqual(requireProjectGuid('\u00850f8fad5b-d9cb-469f-a165-70867728950e\u0085'), '0f8fad5b-d9cb-469f-a165-70867728950e');
    });

    it('reads booleans like bool.TryParse', () => {
        assert.ok(vectors.bool.length > 30);
        for (const { input, value } of vectors.bool) {
            assert.strictEqual(parseDotNetBoolean(input), value === true, JSON.stringify(input));
        }
        assert.strictEqual(parseDotNetBoolean(undefined), false);
        assert.strictEqual(parseDotNetBoolean(null), false);
    });

    it('trims "true" like bool.TryParse for every UTF-16 code unit: white space of .NET and NUL', () => {
        const leading = new Set(vectors.boolLeading);
        const trailing = new Set(vectors.boolTrailing);
        assert.strictEqual(leading.size, 26);
        assert.strictEqual(trailing.size, 26);
        for (let code = 0; code <= 0xffff; code++) {
            const unit = String.fromCharCode(code);
            const label = `U+${code.toString(16).padStart(4, '0')}`;
            assert.strictEqual(parseDotNetBoolean(unit + 'true'), leading.has(code), `after ${label}`);
            assert.strictEqual(parseDotNetBoolean('true' + unit), trailing.has(code), `before ${label}`);
        }
    });

    it('trims like string.Trim of .NET', () => {
        assert.strictEqual(trimDotNet(' \t\u0085\u00a0\u3000a b\u2028\r\n'), 'a b');
        assert.strictEqual(trimDotNet('\ufeff a \ufeff'), '\ufeff a \ufeff');
        assert.strictEqual(trimDotNet('\u0000a\u0000'), '\u0000a\u0000');
        assert.strictEqual(trimDotNet(' \u0085 '), '');
        assert.strictEqual(trimDotNet(''), '');
    });

    it('reads property bags like Json.NET, for the strict JSON that Json.NET shares with JSON.parse', () => {
        const relaxed: string[] = [];
        for (const vector of vectors.properties) {
            const label = JSON.stringify(vector.input);
            if (vector.status === 'ok' && !isStrictJson(vector.input)) {
                relaxed.push(vector.input);
                assert.throws(() => readJsonStringMap(vector.input), JsonStringMapError, label);
            } else if (vector.status === 'ok') {
                assert.deepStrictEqual(Array.from(new Map(readJsonStringMap(vector.input))), vector.pairs, label);
            } else {
                assert.throws(() => readJsonStringMap(vector.input), JsonStringMapError, label);
            }
        }
        assert.ok(vectors.properties.filter(vector => vector.status === 'ok').length > 40);
        assert.ok(relaxed.length > 5, 'Json.NET accepts comments, single quotes, trailing commas and more number spellings');
    });

    it('keeps the text of numbers, rejects nested values and keeps every key', () => {
        assert.deepStrictEqual(readJsonStringMap('{"a":1.0,"b":1e3,"c":-0,"d":12345678901234567890,"e":true,"f":null,"g":"x"}'), [
            ['a', '1.0'], ['b', '1e3'], ['c', '-0'], ['d', '12345678901234567890'], ['e', 'true'], ['f', null], ['g', 'x']
        ]);
        assert.deepStrictEqual(readJsonStringMap('{"":"v","a":"1","a":"2"}'), [['', 'v'], ['a', '1'], ['a', '2']]);
        assert.deepStrictEqual(readJsonStringMap(' {\r\n\t"k\\u0041\\"": "\\ud83d\\ude00\\n" } '), [['kA"', '\ud83d\ude00\n']]);
        for (const bad of ['', '{', '{"a"}', '{"a":}', '{"a":{}}', '{"a":[]}', '{"a":1,}', '{"a":01}', '{"a":1.}', '{"a":"b" "c"}', '[]', 'null', '{"a":"b"}x']) {
            assert.throws(() => readJsonStringMap(bad), JsonStringMapError, bad);
        }
    });
});
