// Placed as a separate file for the purpose of unit testing
const utcTimezone: string = "utc";
const localTimezone: string = "local";

export function getNowDateString(timezone: string): string {
    if (timezone === utcTimezone)
    {
        return getUtcDateString(new Date());
    }

    if (timezone === localTimezone)
    {
        return getLocalDateString(new Date());
    }

    throw new Error('Internal error: Unknown timezone');
}

export function getUtcDateString(now: Date): string {
    // Month is zero-based, so adding one
    let month: number = now.getUTCMonth() + 1;
    return `${now.getUTCFullYear()}${getTwoDigitNumber(month)}${getTwoDigitNumber(now.getUTCDate())}-${getTwoDigitNumber(now.getUTCHours())}${getTwoDigitNumber(now.getUTCMinutes())}${getTwoDigitNumber(now.getUTCSeconds())}`;
}

export function getLocalDateString(now: Date): string {
    // Month is zero-based, so adding one
    let month: number = now.getMonth() + 1;    
    return `${now.getFullYear()}${getTwoDigitNumber(month)}${getTwoDigitNumber(now.getDate())}-${getTwoDigitNumber(now.getHours())}${getTwoDigitNumber(now.getMinutes())}${getTwoDigitNumber(now.getSeconds())}`;
}

function getTwoDigitNumber(number: number): string {
    return number < 10? '0'+ number : '' + number;
}