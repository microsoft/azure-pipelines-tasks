/**
 * Neutralizes Azure Pipelines logging-command patterns in a string so untrusted input
 * printed to stdout cannot be executed as an agent command.
 * `##vso[` and `##[` are rewritten to `__vso[` and `__[`, and any CR/LF run is replaced
 * with a single space - a space rather than an empty string, so that a value such as
 * "##\nvso[" cannot be rejoined into a live "##vso[" marker.
 */
export function sanitizeForLoggingCommand(value: string): string;
export function sanitizeForLoggingCommand(value: null | undefined): null | undefined;
export function sanitizeForLoggingCommand(value: string | null | undefined): string | null | undefined {
    if (!value) {
        return value;
    }
    return value
        .replace(/##vso\[/gi, '__vso[')
        .replace(/##\[/g, '__[')
        .replace(/[\r\n]+/g, ' ');
}
