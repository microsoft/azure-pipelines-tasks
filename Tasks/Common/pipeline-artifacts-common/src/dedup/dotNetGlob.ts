/*
 * Port of the glob matcher of DotNet.Glob 2.0.3 (https://github.com/dazinator/DotNet.Glob, commit 995974d4). The agent plugin
 * applies the rules of an .artifactignore file with this library, so the matching has to be the same, corner cases included.
 *
 * DotNet.Glob is distributed under the MIT License:
 *
 *   Copyright (c) 2016 Darrell Tunnell
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 *   documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 *   rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
 *   persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 *   Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 *   WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 *   COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 *   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { ArtifactError } from '../errors';

/** The library throws NotSupportedException for a character that is not valid in a pattern. */
export class GlobSyntaxError extends ArtifactError { }

/** The library reads outside of the text in some situations (IndexOutOfRangeException). */
export class GlobIndexError extends ArtifactError {
    constructor() {
        super('Index was outside the bounds of the array.');
    }
}

/** Matching a pattern took too many steps. */
export class GlobComplexityError extends ArtifactError { }

export interface GlobOptions {
    caseInsensitive?: boolean;
    allowInvalidPathCharacters?: boolean;
}

const MAX_STEPS = 1_000_000;

const ALLOWED_NON_ALPHANUMERIC = new Set(['.', ' ', '!', '#', '-', ';', '=', '@', '~', '_', ':']);
const LETTER_OR_DIGIT = /^[\p{L}\p{Nd}]$/u;
const LETTER = /^\p{L}$/u;
const NULL_CHAR = '\0';

function isPathSeparator(character: string): boolean {
    return character === '/' || character === '\\';
}

function isLetterOrDigit(character: string): boolean {
    return LETTER_OR_DIGIT.test(character);
}

function isValidLiteralCharacter(character: string): boolean {
    return isLetterOrDigit(character) || ALLOWED_NON_ALPHANUMERIC.has(character);
}

function isNotStartOfToken(character: string): boolean {
    return character !== '!' && character !== '*' && character !== '[' && character !== '?';
}

/**
 * .NET compares with the simple case mapping of its own Unicode data and does not map "ı" to "I", JavaScript uses the full mapping
 * (two characters for some letters) and its own, newer or older, Unicode data. These are the characters of the basic multilingual
 * plane where the two differ (generated with .NET 10, compared with the case mapping of Node.js 20 and 24).
 */
const UPPER_EXCEPTIONS = new Map<number, number>([
    [0x0131, 0x0131], [0x019B, 0x019B], [0x0264, 0x0264], [0x1C8A, 0x1C8A], [0x1F80, 0x1F88], [0x1F81, 0x1F89],
    [0x1F82, 0x1F8A], [0x1F83, 0x1F8B], [0x1F84, 0x1F8C], [0x1F85, 0x1F8D], [0x1F86, 0x1F8E], [0x1F87, 0x1F8F],
    [0x1F90, 0x1F98], [0x1F91, 0x1F99], [0x1F92, 0x1F9A], [0x1F93, 0x1F9B], [0x1F94, 0x1F9C], [0x1F95, 0x1F9D],
    [0x1F96, 0x1F9E], [0x1F97, 0x1F9F], [0x1FA0, 0x1FA8], [0x1FA1, 0x1FA9], [0x1FA2, 0x1FAA], [0x1FA3, 0x1FAB],
    [0x1FA4, 0x1FAC], [0x1FA5, 0x1FAD], [0x1FA6, 0x1FAE], [0x1FA7, 0x1FAF], [0x1FB3, 0x1FBC], [0x1FC3, 0x1FCC],
    [0x1FF3, 0x1FFC], [0xA7CD, 0xA7CD], [0xA7CF, 0xA7CF], [0xA7D3, 0xA7D3], [0xA7D5, 0xA7D5], [0xA7DB, 0xA7DB]
]);
const LOWER_EXCEPTIONS = new Map<number, number>([
    [0x1C89, 0x1C89], [0xA7CB, 0xA7CB], [0xA7CC, 0xA7CC], [0xA7CE, 0xA7CE], [0xA7D2, 0xA7D2], [0xA7D4, 0xA7D4],
    [0xA7DA, 0xA7DA], [0xA7DC, 0xA7DC]
]);

function upper(character: string): string {
    if (character.length !== 1) {
        return character;
    }
    const exception = UPPER_EXCEPTIONS.get(character.charCodeAt(0));
    if (exception !== undefined) {
        return String.fromCharCode(exception);
    }
    const converted = character.toUpperCase();
    return converted.length === 1 ? converted : character;
}

function lower(character: string): string {
    if (character.length !== 1) {
        return character;
    }
    const exception = LOWER_EXCEPTIONS.get(character.charCodeAt(0));
    if (exception !== undefined) {
        return String.fromCharCode(exception);
    }
    const converted = character.toLowerCase();
    return converted.length === 1 ? converted : character;
}

type Token =
    | { kind: 'separator'; value: string }
    | { kind: 'literal'; value: string }
    | { kind: 'anyCharacter' }
    | { kind: 'wildcard' }
    | { kind: 'wildcardDirectory'; leading?: string; trailing?: string }
    | { kind: 'characterList'; characters: string[]; negated: boolean }
    | { kind: 'letterRange'; start: string; end: string; negated: boolean }
    | { kind: 'numberRange'; start: string; end: string; negated: boolean };

class Reader {
    private readonly text: string;
    private next = 0;
    current = NULL_CHAR;

    constructor(text: string) {
        this.text = text;
    }

    read(): number {
        if (this.next >= this.text.length) {
            return -1;
        }
        this.current = this.text[this.next++];
        return this.current.charCodeAt(0);
    }

    readChar(): boolean {
        return this.read() !== -1;
    }

    peekChar(): string {
        return this.next >= this.text.length ? NULL_CHAR : this.text[this.next];
    }

    get hasReachedEnd(): boolean {
        return this.next >= this.text.length;
    }
}

function tokenise(text: string, allowInvalidPathCharacters: boolean): Token[] {
    const tokens: Token[] = [];
    const buffer: string[] = [];
    const reader = new Reader(text);

    const accept = (): void => { buffer.push(reader.current); };
    const takeBuffer = (): string => { const value = buffer.join(''); buffer.length = 0; return value; };

    const readLiteral = (): Token => {
        if (!allowInvalidPathCharacters && !isValidLiteralCharacter(reader.current)) {
            throw new GlobSyntaxError(`${reader.current} is not a supported character for a pattern.`);
        }
        accept();
        while (!reader.hasReachedEnd) {
            const peek = reader.peekChar();
            const valid = allowInvalidPathCharacters ? isNotStartOfToken(peek) && !isPathSeparator(peek) : isValidLiteralCharacter(peek);
            if (!valid) {
                break;
            }
            if (reader.readChar()) {
                accept();
            } else {
                break;
            }
        }
        return { kind: 'literal', value: takeBuffer() };
    };

    const readRangeOrList = (): Token => {
        let negated = false;
        let numberRange = false;
        let letterRange = false;
        let characterList = false;

        if (reader.peekChar() === '!') {
            negated = true;
            reader.read();
        }

        let next = reader.peekChar();
        if (isLetterOrDigit(next)) {
            reader.read();
            next = reader.peekChar();
            if (next === '-') {
                if (LETTER.test(reader.current)) {
                    letterRange = true;
                } else {
                    numberRange = true;
                }
            } else {
                characterList = true;
            }
            accept();
        } else {
            characterList = true;
            reader.read();
            accept();
        }

        if (letterRange || numberRange) {
            reader.readChar();
        }

        while (reader.readChar()) {
            if (reader.current === ']') {
                if (reader.peekChar() === ']') {
                    accept();
                } else {
                    break;
                }
            } else {
                accept();
            }
        }

        const value = takeBuffer();
        if (characterList) {
            return { kind: 'characterList', characters: value.split(''), negated };
        }
        if (value.length < 2) {
            throw new GlobIndexError();
        }
        return letterRange
            ? { kind: 'letterRange', start: value[0], end: value[1], negated }
            : { kind: 'numberRange', start: value[0], end: value[1], negated };
    };

    const readDirectoryWildcard = (leading: string | undefined): Token => {
        reader.readChar();
        if (isPathSeparator(reader.peekChar())) {
            reader.readChar();
            return { kind: 'wildcardDirectory', leading, trailing: reader.current };
        }
        return { kind: 'wildcardDirectory', leading, trailing: undefined };
    };

    while (reader.readChar()) {
        const current = reader.current;
        if (current === '[') {
            tokens.push(readRangeOrList());
        } else if (current === '?') {
            tokens.push({ kind: 'anyCharacter' });
        } else if (current === '*' && reader.peekChar() !== '*') {
            tokens.push({ kind: 'wildcard' });
        } else if (isPathSeparator(current)) {
            tokens.push({ kind: 'separator', value: current });
        } else if (current === '*' && reader.peekChar() === '*') {
            const last = tokens[tokens.length - 1];
            if (last && last.kind === 'separator') {
                tokens.pop();
                tokens.push(readDirectoryWildcard(last.value));
                continue;
            }
            tokens.push(readDirectoryWildcard(undefined));
        } else {
            tokens.push(readLiteral());
        }
    }
    return tokens;
}

interface Out { position: number }

interface Evaluator {
    readonly consumesMinLength: number;
    readonly consumesVariableLength: boolean;
    isMatch(all: string, position: number, out: Out): boolean;
}

interface Context {
    readonly caseInsensitive: boolean;
    steps: number;
}

function charAt(all: string, position: number): string {
    if (position < 0 || position >= all.length) {
        throw new GlobIndexError();
    }
    return all[position];
}

function step(context: Context): void {
    if (++context.steps > MAX_STEPS) {
        throw new GlobComplexityError('The pattern takes too long to match.');
    }
}

class LiteralEvaluator implements Evaluator {
    readonly consumesMinLength: number;
    readonly consumesVariableLength = false;
    private readonly value: string;

    constructor(token: { value: string }, private readonly context: Context) {
        this.value = context.caseInsensitive ? Array.from(token.value, upper).join('') : token.value;
        this.consumesMinLength = token.value.length;
    }

    isMatch(all: string, position: number, out: Out): boolean {
        out.position = position;
        let counter = 0;
        while (out.position < all.length && counter < this.value.length) {
            const character = charAt(all, out.position);
            if ((this.context.caseInsensitive ? upper(character) : character) !== this.value[counter]) {
                return false;
            }
            out.position++;
            counter++;
        }
        return counter >= this.value.length;
    }
}

class AnyCharacterEvaluator implements Evaluator {
    readonly consumesMinLength = 1;
    readonly consumesVariableLength = false;

    isMatch(all: string, position: number, out: Out): boolean {
        out.position = position + 1;
        return !isPathSeparator(charAt(all, position));
    }
}

class CharacterListEvaluator implements Evaluator {
    readonly consumesMinLength = 1;
    readonly consumesVariableLength = false;
    private readonly characters: string[];

    constructor(private readonly token: { characters: string[]; negated: boolean }, private readonly context: Context) {
        this.characters = context.caseInsensitive ? token.characters.map(upper) : token.characters;
    }

    isMatch(all: string, position: number, out: Out): boolean {
        const character = charAt(all, position);
        out.position = position + 1;
        const contains = this.characters.includes(this.context.caseInsensitive ? upper(character) : character);
        return this.token.negated ? !contains : contains;
    }
}

class LetterRangeEvaluator implements Evaluator {
    readonly consumesMinLength = 1;
    readonly consumesVariableLength = false;

    constructor(private readonly token: { start: string; end: string; negated: boolean }, private readonly context: Context) { }

    isMatch(all: string, position: number, out: Out): boolean {
        const character = charAt(all, position);
        out.position = position + 1;
        const { start, end, negated } = this.token;
        const matched = this.context.caseInsensitive
            ? (character >= upper(start) && character <= upper(end)) || (character >= lower(start) && character <= lower(end))
            : character >= start && character <= end;
        return negated ? !matched : matched;
    }
}

class NumberRangeEvaluator implements Evaluator {
    readonly consumesMinLength = 1;
    readonly consumesVariableLength = false;

    constructor(private readonly token: { start: string; end: string; negated: boolean }) { }

    isMatch(all: string, position: number, out: Out): boolean {
        const character = charAt(all, position);
        out.position = position + 1;
        if (character >= this.token.start && character <= this.token.end) {
            if (this.token.negated) {
                return false;
            }
        } else if (!this.token.negated) {
            return false;
        }
        return true;
    }
}

class SeparatorEvaluator implements Evaluator {
    readonly consumesMinLength = 1;
    readonly consumesVariableLength = false;

    isMatch(all: string, position: number, out: Out): boolean {
        const character = charAt(all, position);
        out.position = position + 1;
        return isPathSeparator(character);
    }
}

class WildcardEvaluator implements Evaluator {
    readonly consumesVariableLength = true;
    private readonly requiresSubEvaluation: boolean;

    constructor(private readonly sub: CompositeEvaluator, private readonly context: Context) {
        this.requiresSubEvaluation = sub.evaluatorCount > 0;
    }

    get consumesMinLength(): number {
        return this.sub.consumesMinLength;
    }

    isMatch(all: string, position: number, out: Out): boolean {
        out.position = position;

        if (!this.requiresSubEvaluation) {
            if (position >= all.length) {
                return true;
            }
            for (let i = position; i <= all.length - 1; i++) {
                if (isPathSeparator(all[i])) {
                    return false;
                }
            }
            out.position = position + all.length;
            return true;
        }

        if (!this.sub.consumesVariableLength) {
            const requiredMatchPosition = all.length - this.sub.consumesMinLength;
            for (let i = position; i < requiredMatchPosition; i++) {
                if (isPathSeparator(all[i])) {
                    return false;
                }
            }
            return this.sub.isMatch(all, requiredMatchPosition, out);
        }

        const maxPosition = all.length - this.sub.consumesMinLength;
        for (let i = position; i <= maxPosition; i++) {
            step(this.context);
            const current = charAt(all, i);
            if (this.sub.isMatch(all, i, out)) {
                return true;
            }
            if (isPathSeparator(current)) {
                return false;
            }
        }
        return false;
    }
}

class WildcardDirectoryEvaluator implements Evaluator {
    readonly consumesVariableLength = true;

    constructor(private readonly token: { leading?: string; trailing?: string }, private readonly sub: CompositeEvaluator, private readonly context: Context) { }

    get consumesMinLength(): number {
        return this.sub.consumesMinLength;
    }

    isMatch(all: string, position: number, out: Out): boolean {
        out.position = position;

        if (position >= all.length) {
            return true;
        }

        let character = all[position];
        if (this.token.leading !== undefined) {
            if (!isPathSeparator(character)) {
                return false;
            }
            position = position + 1;
        }

        if (this.sub.evaluatorCount === 0) {
            out.position = all.length;
            return true;
        }

        const maxPosition = all.length - this.sub.consumesMinLength;

        if (!this.sub.consumesVariableLength) {
            if (maxPosition > 0) {
                if (!isPathSeparator(charAt(all, maxPosition - 1))) {
                    return false;
                }
            }
            position = maxPosition;
            return this.sub.isMatch(all, position, out);
        }

        character = charAt(all, position);
        if (this.token.trailing !== undefined && isPathSeparator(character)) {
            position = position + 1;
        }

        while (position <= maxPosition) {
            step(this.context);
            if (this.sub.isMatch(all, position, out)) {
                return true;
            }
            if (position === maxPosition) {
                return false;
            }
            while (position < maxPosition) {
                position = position + 1;
                character = charAt(all, position);
                if (isPathSeparator(character)) {
                    position = position + 1;
                    break;
                }
            }
        }
        return false;
    }
}

class CompositeEvaluator implements Evaluator {
    consumesMinLength = 0;
    consumesVariableLength: boolean;
    private readonly evaluators: Evaluator[] = [];

    constructor(tokens: readonly Token[], private readonly context: Context) {
        this.consumesVariableLength = tokens.length === 0;
        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            switch (token.kind) {
                case 'separator': this.add(new SeparatorEvaluator()); break;
                case 'literal': this.add(new LiteralEvaluator(token, context)); break;
                case 'anyCharacter': this.add(new AnyCharacterEvaluator()); break;
                case 'letterRange': this.add(new LetterRangeEvaluator(token, context)); break;
                case 'numberRange': this.add(new NumberRangeEvaluator(token)); break;
                case 'characterList': this.add(new CharacterListEvaluator(token, context)); break;
                case 'wildcard':
                    this.add(new WildcardEvaluator(new CompositeEvaluator(tokens.slice(index + 1), context), context));
                    return;
                case 'wildcardDirectory':
                    this.add(new WildcardDirectoryEvaluator(token, new CompositeEvaluator(tokens.slice(index + 1), context), context));
                    return;
            }
        }
    }

    get evaluatorCount(): number {
        return this.evaluators.length;
    }

    private add(evaluator: Evaluator): void {
        this.evaluators.push(evaluator);
        this.consumesMinLength += evaluator.consumesMinLength;
        if (!this.consumesVariableLength && evaluator.consumesVariableLength) {
            this.consumesVariableLength = true;
        }
    }

    isMatch(all: string, position: number, out: Out): boolean {
        out.position = position;
        step(this.context);

        if (!this.consumesVariableLength) {
            if (all.length - position !== this.consumesMinLength) {
                return false;
            }
        } else if (all.length - position < this.consumesMinLength) {
            return false;
        }

        for (const evaluator of this.evaluators) {
            if (!evaluator.isMatch(all, out.position, out)) {
                return false;
            }
        }

        // The library accepts a match that leaves the last character of the text unmatched.
        return out.position >= all.length - 1;
    }
}

export class DotNetGlob {
    private readonly root: CompositeEvaluator;
    private readonly context: Context;

    private constructor(tokens: Token[], caseInsensitive: boolean) {
        this.context = { caseInsensitive, steps: 0 };
        this.root = new CompositeEvaluator(tokens, this.context);
    }

    static parse(pattern: string, options: GlobOptions = {}): DotNetGlob {
        if (pattern === '') {
            throw new GlobSyntaxError('Value cannot be null. (Parameter \'\')');
        }
        return new DotNetGlob(tokenise(pattern, options.allowInvalidPathCharacters === true), options.caseInsensitive === true);
    }

    isMatch(text: string): boolean {
        this.context.steps = 0;
        return this.root.isMatch(text, 0, { position: 0 });
    }
}
