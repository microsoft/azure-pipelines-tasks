import * as tl from 'azure-pipelines-task-lib/task';

// Characters that must never appear in a filesystem path passed to this task.
// - Control characters (NUL, CR, LF) are never valid in a path and can break the
//   quoting context of the shell command the value is embedded in.
// - The shell command-chaining / substitution operators (; | & $ ` < >) are
//   effectively never part of a real build-source directory path and are the
//   primitives that turn an interpolated path into executed code. They are
//   rejected at intake as defense-in-depth; escaping at the sink is the primary
//   protection. Spaces, parentheses and brackets are intentionally allowed so
//   legitimate Windows paths (e.g. "C:\Program Files (x86)\src") are unaffected.
const DISALLOWED_APP_SOURCE_PATH_CHARS: RegExp = /[;|&$`<>\u0000\r\n]/;

/**
 * Escapes a value so it is safe to embed as a single argument inside a command
 * string that is executed by Bash via `bash -c`. The value is wrapped in single
 * quotes; any embedded single quote is closed, escaped, and reopened
 * (`'\''`). Inside single quotes Bash performs no expansion or word splitting,
 * so no metacharacter in the value can be interpreted as code.
 * @param value - the raw value to escape
 * @returns the single-quoted, shell-safe representation of the value
 */
export function escapeBashArg(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Escapes a value so it is safe to embed as a single argument inside a command
 * string that is executed by PowerShell via `pwsh -command`. The value is
 * wrapped in single quotes; any embedded single quote is doubled (`''`), which
 * is PowerShell's literal-string escaping. Inside single quotes PowerShell
 * performs no expansion, so no metacharacter in the value can be interpreted as
 * code. Backslashes remain literal, keeping Windows paths intact.
 * @param value - the raw value to escape
 * @returns the single-quoted, PowerShell-safe representation of the value
 */
export function escapePowerShellArg(value: string): string {
    return `'${value.replace(/'/g, `''`)}'`;
}

/**
 * Escapes a value for embedding in a command string executed by the shell of the
 * current agent (`pwsh -command` on Windows, `bash -c` otherwise).
 * @param value - the raw value to escape
 * @param isWindows - whether the current agent is Windows (uses PowerShell)
 * @returns the shell-safe representation of the value for the current agent
 */
export function escapeShellArg(value: string, isWindows: boolean): string {
    return isWindows ? escapePowerShellArg(value) : escapeBashArg(value);
}

/**
 * Quotes a value for embedding in a command string that is passed to
 * `tl.execSync(tool, argLine)`. In that form the task library parses the string
 * into an argv array (it does NOT invoke a shell), so the risk is argument
 * injection via unquoted whitespace rather than shell metacharacter execution.
 * Wrapping the value in double quotes (escaping any embedded double quote) keeps
 * it a single argument so its contents cannot be interpreted as additional
 * arguments.
 * @param value - the raw value to quote
 * @returns the double-quoted representation safe for tl.execSync arg-string parsing
 */
export function quoteExecArg(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`;
}

/**
 * Validates the user-controlled `appSourcePath` input at intake. The value is
 * documented and intended to be a filesystem path, not code; this check rejects
 * values containing control characters or shell command-chaining / substitution
 * operators before the path is ever used to build a command. This is a
 * defense-in-depth complement to per-sink escaping.
 * @param appSourcePath - the raw appSourcePath input value
 * @throws Error (localized 'InvalidAppSourcePathMessage') if the value contains
 *         disallowed characters
 */
export function validateAppSourcePath(appSourcePath: string): void {
    if (appSourcePath === undefined || appSourcePath === null || appSourcePath.length === 0) {
        return;
    }

    if (DISALLOWED_APP_SOURCE_PATH_CHARS.test(appSourcePath)) {
        const message: string = tl.loc('InvalidAppSourcePathMessage');
        tl.error(message);
        throw new Error(message);
    }
}
