/**
 * Strips Azure Pipelines logging-command patterns (##vso[...] and ##[...]) from a string
 * to prevent command injection via untrusted input printed to stdout.
 * Also removes newlines that could be used to start a new line with a ##vso[ prefix.
 */
export function sanitizeForLoggingCommand(value: string): string {
    if (!value) {
        return value;
    }
    return value
        .replace(/##vso\[/gi, '__vso[')
        .replace(/##\[/g, '__[')
        .replace(/[\r\n]+/g, ' ');
}
