// Placed as a separate file for the purpose of unit testing

export function getUtcDateString(): string {
    let now: Date = new Date();
    return `${now.getFullYear()}${now.getUTCMonth()}${now.getUTCDate()}-${now.getUTCHours()}${now.getUTCMinutes()}${now.getUTCSeconds()}`;
}