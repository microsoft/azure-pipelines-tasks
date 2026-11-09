const INT32_PATTERN = /^[\t-\r ]*([+-]?)([0-9]+)[\t-\r ]*\u0000*$/;
const GUID_PARTS = '([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})';
const GUID_PATTERNS = [
    new RegExp(`^${GUID_PARTS}$`, 'i'),
    new RegExp(`^\\{${GUID_PARTS}\\}$`, 'i'),
    new RegExp(`^\\(${GUID_PARTS}\\)$`, 'i'),
    /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i
];

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/** char.IsWhiteSpace of .NET. It differs from the white space of JavaScript: U+0085 is white space only in .NET and U+FEFF only in JavaScript. */
export function isDotNetWhiteSpace(code: number): boolean {
    return (code >= 0x09 && code <= 0x0d) || code === 0x20 || code === 0x85 || code === 0xa0 || code === 0x1680
        || (code >= 0x2000 && code <= 0x200a) || code === 0x2028 || code === 0x2029 || code === 0x202f || code === 0x205f || code === 0x3000;
}

/** string.IsNullOrWhiteSpace */
export function isNullOrWhiteSpace(text: string | undefined | null): boolean {
    if (text === undefined || text === null) {
        return true;
    }
    for (let index = 0; index < text.length; index++) {
        if (!isDotNetWhiteSpace(text.charCodeAt(index))) {
            return false;
        }
    }
    return true;
}

function trimWhere(text: string, trimmed: (code: number) => boolean): string {
    let start = 0;
    let end = text.length;
    while (start < end && trimmed(text.charCodeAt(start))) {
        start++;
    }
    while (end > start && trimmed(text.charCodeAt(end - 1))) {
        end--;
    }
    return text.substring(start, end);
}

/** string.Trim() */
export function trimDotNet(text: string): string {
    return trimWhere(text, isDotNetWhiteSpace);
}

/** Like bool.TryParse(text, out var value) && value: "true" in any case, with white space or NUL characters around it. */
export function parseDotNetBoolean(text: string | undefined | null): boolean {
    return text !== undefined && text !== null && /^true$/i.test(trimWhere(text, code => code === 0 || isDotNetWhiteSpace(code)));
}

/** Like int.TryParse(string, out int): optional white space and sign around ASCII digits, within the 32 bit range. */
export function parseDotNetInt32(text: string | undefined): number | undefined {
    const match = text === undefined ? null : INT32_PATTERN.exec(text);
    if (!match) {
        return undefined;
    }
    const value = Number(match[1] + match[2]);
    if (value < -2147483648 || value > 2147483647) {
        return undefined;
    }
    return value === 0 ? 0 : value;
}

/**
 * Like Guid.TryParse for the formats N, D, B and P, returning the lower case "D" form. The hexadecimal format X is not
 * supported.
 */
export function parseDotNetGuid(text: string | undefined): string | undefined {
    if (text === undefined) {
        return undefined;
    }
    const value = trimDotNet(text);
    for (const pattern of GUID_PATTERNS) {
        const match = pattern.exec(value);
        if (match) {
            return match.slice(1, 6).join('-').toLowerCase();
        }
    }
    return undefined;
}

/** Like Guid.Parse followed by ArgUtil.NotEmpty: the project id of the current run must be a GUID, and not all zeros. */
export function requireProjectGuid(text: string): string {
    const guid = parseDotNetGuid(text);
    if (guid === undefined || guid === EMPTY_GUID) {
        throw new Error(`The project id '${text}' is not a valid GUID.`);
    }
    return guid;
}
