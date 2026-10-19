// Characters and escape spellings that changed a name in the legacy hand-built command.
// Raw delimiters corrupted the command while tokens were unescaped by the agent. The safe
// command escapes the leading '%' first, so those tokens now remain literal.
const legacyChangingPattern = /[;\]\r\n]|%(?:3B|5D|0D|0A|AZP25)/;

/**
 * Reports whether a variable name was truncated, corrupted, or decoded by the legacy
 * hand-built logging command, and so resolves differently now that the declared name is
 * escaped. Used to warn the user that a name they may have referenced has changed.
 */
export function wasTruncatedByLegacyCommandFormat(variableName: string | null | undefined): boolean {
    return !!variableName && legacyChangingPattern.test(variableName);
}

// detect logging commands. We match #+ (not just ##) so that inputs like "####vso[" are
// fully neutralised in a single pass rather than leaving a residual "##vso[" after
// replacing the inner match. Case-insensitive because the agent accepts any casing.
const vsoCommandPattern = /#+vso\[/gi;

// Matches one or more # followed by [ - the prefix for formatting commands such as
// ##[warning] and ##[section].
const formattingCommandPattern = /#+\[/g;

/**
 * Neutralizes Azure Pipelines logging-command prefixes in untrusted text so the agent
 * cannot interpret it as a command.
 *
 * The agent locates the marker with an index-of match, so it is honoured anywhere on a
 * line and not only at the start. Any CR/LF run is therefore collapsed to a single space
 * as well - a space rather than an empty string, so that a value such as "##\nvso[" cannot
 * be rejoined into a live "##vso[" marker.
 *
 * The replacement preserves the text for human readability while making it invisible to
 * the agent's command parser.
 */
export function sanitizeForLoggingCommand(value: string): string;
export function sanitizeForLoggingCommand(value: null | undefined): null | undefined;
export function sanitizeForLoggingCommand(value: string | null | undefined): string | null | undefined {
    if (!value) {
        return value;
    }
    return value
        .replace(vsoCommandPattern, '#vso[')
        .replace(formattingCommandPattern, '#[')
        .replace(/[\r\n]+/g, ' ');
}
