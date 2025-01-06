export function addArg(commandLine: string, arg: string) : string {
    if (isNullEmptyOrUndefined(arg)) {
        return commandLine;
    }

    if (isNullEmptyOrUndefined(commandLine)) {
        return arg;
    }
    return commandLine + ' ' + arg;
}

export function isNullEmptyOrUndefined(obj: any) {
    return obj === null || obj === '' || obj === undefined;
}