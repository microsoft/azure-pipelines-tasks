export function flattenObject(object: any) {
    return JSON.parse(JSON.stringify(object));
}