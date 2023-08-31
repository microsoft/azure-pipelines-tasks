// TODO: This file should be moved to the common package as a spotbugs tool
/**
 * Remove the UTF-8 byte order mask (BOM).
 *
 * Copies the behavior of the strip-bom package: https://github.com/sindresorhus/strip-bom/blob/main/index.js
 *
 * @param str - string with byte order mask
 */
export function removeBom(str: string): string {
    if (str.charCodeAt(0) === 0xFEFF) {
        return str.slice(1);
    }
    return str;
}
