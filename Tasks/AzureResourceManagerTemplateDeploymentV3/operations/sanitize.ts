// Characters that corrupted the legacy hand-built logging command. The agent scans for the
// first ']' after the marker and splits properties on ';', and a line break ended the
// command outright. A name containing any of these therefore resolved to a different -
// usually truncated - variable before the escaped path was introduced.
const legacyTruncatingPattern = /[;\]\r\n]/;

/**
 * Reports whether a variable name would have been truncated or corrupted by the legacy
 * hand-built logging command, and so resolves to a different variable now that the name is
 * escaped. Used to warn the user that a name they may have referenced has changed.
 */
export function wasTruncatedByLegacyCommandFormat(variableName: string | null | undefined): boolean {
    return !!variableName && legacyTruncatingPattern.test(variableName);
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
