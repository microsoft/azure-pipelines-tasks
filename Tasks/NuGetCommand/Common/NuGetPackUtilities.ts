// Placed as a separate file for the purpose of unit testing

export function getNowUtcDateString(): string {
    return getUtcDateString(new Date());
}

export function getUtcDateString(now: Date): string {
    return `${now.getFullYear()}${getTwoDigitNumber(now.getUTCMonth())}${getTwoDigitNumber(now.getUTCDate())}-${getTwoDigitNumber(now.getUTCHours())}${getTwoDigitNumber(now.getUTCMinutes())}${getTwoDigitNumber(now.getUTCSeconds())}`;
}

function getTwoDigitNumber(number: number): string {
    return number < 10? '0'+ number : '' + number;
}