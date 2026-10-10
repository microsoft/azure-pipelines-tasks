import { ArtifactError } from '../errors';

export class JsonStringMapError extends ArtifactError { }

const NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const LITERAL = /true|false|null/y;

/**
 * Reads a JSON object with simple values as the agent plugin did with Json.NET and a Dictionary<string, string>: the text of a
 * number or a boolean is kept as written ("1.0" stays "1.0"), null stays null, and nested objects and arrays are rejected.
 * Only strict JSON is accepted; Json.NET also accepted comments, single quotes, trailing commas and a few more number spellings.
 */
export function readJsonStringMap(text: string): Array<[string, string | null]> {
    let position = 0;

    const fail = (): never => {
        throw new JsonStringMapError(`The text is not a JSON object with simple values (position ${position}).`);
    };

    const skipWhitespace = (): void => {
        while (position < text.length && ' \t\n\r'.includes(text[position])) {
            position++;
        }
    };

    const readString = (): string => {
        const start = position++;
        while (position < text.length && text[position] !== '"') {
            position += text[position] === '\\' ? 2 : 1;
        }
        if (position >= text.length) {
            return fail();
        }
        position++;
        try {
            return JSON.parse(text.substring(start, position)) as string;
        } catch {
            return fail();
        }
    };

    const readToken = (pattern: RegExp): string | undefined => {
        pattern.lastIndex = position;
        const match = pattern.exec(text);
        if (!match) {
            return undefined;
        }
        position += match[0].length;
        return match[0];
    };

    const readValue = (): string | null => {
        if (text[position] === '"') {
            return readString();
        }
        const token = readToken(NUMBER) ?? readToken(LITERAL) ?? fail();
        return token === 'null' ? null : token;
    };

    const pairs: Array<[string, string | null]> = [];
    skipWhitespace();
    if (text[position++] !== '{') {
        fail();
    }
    skipWhitespace();
    if (text[position] === '}') {
        position++;
    } else {
        for (; ;) {
            skipWhitespace();
            if (text[position] !== '"') {
                fail();
            }
            const key = readString();
            skipWhitespace();
            if (text[position++] !== ':') {
                fail();
            }
            skipWhitespace();
            pairs.push([key, readValue()]);
            skipWhitespace();
            const separator = text[position++];
            if (separator === '}') {
                break;
            }
            if (separator !== ',') {
                fail();
            }
        }
    }
    skipWhitespace();
    if (position < text.length) {
        fail();
    }
    return pairs;
}
