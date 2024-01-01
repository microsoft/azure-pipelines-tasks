export enum StringComparer {
    Ordinal,
    OrdinalIgnoreCase,
}

export function isEqual(str1: string, str2: string, stringComparer: StringComparer): boolean {

    if (str1 == null && str2 == null) {
        return true;
    }

    if (str1 == null) {
        return false;
    }

    if (str2 == null) {
        return false;
    }

    if (stringComparer == StringComparer.OrdinalIgnoreCase) {
        return str1.toUpperCase() === str2.toUpperCase();
    } else {
        return str1 === str2;
    }
}