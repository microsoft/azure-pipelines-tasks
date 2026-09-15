/**
 * Neutralizes Azure Pipelines logging commands in untrusted log output while
 * preserving the original diagnostic text and line structure.
 */
export function sanitizeForLoggingCommand(value: string): string {
    return value.replace(/##vso\[/gi, '##_vso[');
}
