// Matches one or more # followed by vso[ - the prefix the Azure Pipelines agent uses to
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
