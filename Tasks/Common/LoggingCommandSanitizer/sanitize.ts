// Format diagnostic values only; deployment APIs must receive the original paths.
export function sanitizeForLoggingCommand(value: string): string {
    return value
        .replace(/#+vso\[/gi, '#vso[')
        .replace(/#+\[/g, '#[')
        .replace(/[\r\n]+/g, ' ');
}
