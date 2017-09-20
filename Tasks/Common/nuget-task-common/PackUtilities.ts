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
    let year: string = "" + now.getUTCFullYear();
    let month: string = getTwoDigitNumberString(now.getUTCMonth() + 1); // Month is zero-based, so adding one
    let date: string = getTwoDigitNumberString(now.getUTCDate());
    let hours: string = getTwoDigitNumberString(now.getUTCHours());
    let minutes: string = getTwoDigitNumberString(now.getUTCMinutes());
    let seconds: string = getTwoDigitNumberString(now.getUTCSeconds());

    return `${year}${month}${date}-${hours}${minutes}${seconds}`;
}

export function getLocalDateString(now: Date): string {
    let year: string = "" + now.getFullYear();
    let month: string = getTwoDigitNumberString(now.getMonth() + 1); // Month is zero-based, so adding one
    let date: string = getTwoDigitNumberString(now.getDate());
    let hours: string = getTwoDigitNumberString(now.getHours());
    let minutes: string = getTwoDigitNumberString(now.getMinutes());
    let seconds: string = getTwoDigitNumberString(now.getSeconds());

    return `${year}${month}${date}-${hours}${minutes}${seconds}`;
}

function getTwoDigitNumberString(number: number): string {
    return number < 10 ? '0' + number : '' + number;
}