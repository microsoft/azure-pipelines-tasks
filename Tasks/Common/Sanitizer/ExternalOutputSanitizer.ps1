# Neutralizes Azure Pipelines logging command markers ("##vso[...]" and the
# classic "##[...]" formatting marker) that may appear in text a task did not
# itself author - for example rows returned by a SQL query, or any other
# output an attacker who can influence external data (a database, a file, a
# child process) could shape.
#
# The agent's log parser looks for these markers anywhere in a line of stdout,
# not only at the start of the line. If a task prints untrusted external data
# verbatim, an attacker can smuggle in a command such as
# "##vso[task.setvariable variable=BASH_ENV]..." and have the agent execute it
# as if the task itself had logged it, which has been used to achieve remote
# code execution in later steps.
#
# This is a PowerShell port of azure-pipelines-task-lib's Node SDK external-
# output filter (MarkerFilter / ExternalOutputOptions in externaloutput.ts,
# added by task-lib PR #1219 "unified logger"), for PowerShell tasks that
# print raw external output instead of piping it through that SDK. It
# deliberately mirrors that module's API shape so the two stay conceptually
# interchangeable:
#   - Default-deny: every "##vso[" marker is blocked unless -EnableVsoCommands
#     is set.
#   - Opt-in allowlist: when enabled, only an "area.event" command name present
#     in -AllowedVsoCommands (default: task.debug, task.setprogress) passes
#     through unmodified; unknown commands, malformed names, or a header that
#     never reaches a terminator all stay blocked (fail closed) - mirroring
#     the Node filter's canonicalCommandName/MAX_HEADER handling.
#   - -Source is required, matching the Node interface's mandatory `source`
#     field. It is documentation/telemetry only and never changes filtering
#     behavior, but it forces each call site to record why untrusted text is
#     being routed through this function.
#
# Two differences from the Node module, both deliberate:
#   - The Node filter operates on a raw byte stream because it must survive a
#     marker split across chunk boundaries and must not corrupt invalid
#     UTF-8/binary output. PowerShell callers invoke this per decoded
#     line/string (e.g. piping Invoke-Sqlcmd rows), so there is no streaming
#     boundary to track; this function matches on the decoded .NET string.
#   - Marker detection itself ("##vso[") stays case-insensitive here even
#     though the agent/Node module use an exact ordinal match. Over-
#     neutralizing a line the agent's real parser would not have treated as a
#     command has no downside; this choice was validated end-to-end and is
#     preserved unchanged.
#
# Only pass text that originates outside the task's own control through this
# function. Never pass the task's own literal "##vso[...]" strings (for
# example a task.uploadfile or task.setVariable call the task emits itself)
# through it - those are trusted and must remain unescaped so the agent still
# executes them.

# Commands allowed by default once -EnableVsoCommands is set, mirroring
# azure-pipelines-task-lib's defaultAllowedVsoCommands.
$script:DefaultAllowedVsoCommands = [string[]] @('task.debug', 'task.setprogress')

# Matches a "##vso[" marker (case-insensitive - see note above) together with
# whatever looks like its command-name header: everything up to the first
# space, ']', CR or LF. The terminator group is optional so a header that runs
# to the end of the string without one still matches - the evaluator fails
# closed in that case, mirroring the Node filter's flush() handling of an
# incomplete command candidate.
$script:VsoMarkerPattern = [regex]::new(
    '##vso\[(?<name>[^ \]\r\n]*)(?<term>[ \]\r\n])?',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

# Maximum command-name characters inspected before giving up and failing
# closed, mirroring the Node filter's MAX_HEADER bound.
$script:MaxVsoCommandNameLength = 256

# Normalizes a raw command-name token to the agent's canonical "area.event"
# form, or $null when it is not a valid command name. Mirrors the agent's
# Split('.', RemoveEmptyEntries) with a required length of exactly two
# non-empty segments, compared case-insensitively.
function script:Get-CanonicalVsoCommandName {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string] $Name
    )

    $parts = @($Name.Split('.') | Where-Object { $_.Length -gt 0 })
    if ($parts.Count -ne 2) {
        return $null
    }
    return ('{0}.{1}' -f $parts[0], $parts[1]).ToLowerInvariant()
}

function Protect-ExternalOutput {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(ValueFromPipeline = $true)]
        [AllowNull()]
        [AllowEmptyString()]
        [string] $InputObject,

        # Origin of the output. Documentation/telemetry only - mirrors
        # azure-pipelines-task-lib's ExternalOutputSource ('remote' |
        # 'childProcess' | 'repository'). Required, like the Node interface's
        # mandatory `source` field, so every call site states why it is
        # routing untrusted text through this function.
        [Parameter(Mandatory = $true)]
        [ValidateSet('remote', 'childProcess', 'repository')]
        [string] $Source,

        # When omitted/false (the default), every "##vso[" marker is
        # neutralized unconditionally. When set, a marker whose command name
        # is in the effective allowlist passes through unmodified.
        [switch] $EnableVsoCommands,

        # Allowlist of "area.event" command names to permit when
        # -EnableVsoCommands is set. Replaces (does not extend) the default
        # list (task.debug, task.setprogress). An explicit empty array allows
        # nothing. Has no effect when -EnableVsoCommands is not set.
        [string[]] $AllowedVsoCommands
    )

    begin {
        $allowed = $null
        if ($EnableVsoCommands) {
            $list = if ($PSBoundParameters.ContainsKey('AllowedVsoCommands')) { $AllowedVsoCommands } else { $script:DefaultAllowedVsoCommands }
            $allowed = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
            foreach ($command in $list) {
                [void] $allowed.Add($command)
            }
        }
        $enableVsoCommandsLocal = [bool] $EnableVsoCommands
        $maxNameLength = $script:MaxVsoCommandNameLength

        # Built once per call (not per pipeline item) and closed over the
        # settings above, since -EnableVsoCommands/-AllowedVsoCommands do not
        # vary across pipeline input.
        $evaluator = {
            param($match)

            $name = $match.Groups['name'].Value
            $term = $match.Groups['term'].Value

            if (-not $enableVsoCommandsLocal) {
                return "##_vso[$name$term"
            }

            $hasTerminator = $match.Groups['term'].Success
            if (-not $hasTerminator -or $name.Length -gt $maxNameLength) {
                return "##_vso[$name$term"
            }

            $canonical = Get-CanonicalVsoCommandName -Name $name
            if ($canonical -and $allowed.Contains($canonical)) {
                return "##vso[$name$term"
            }
            return "##_vso[$name$term"
        }.GetNewClosure()
    }

    process {
        if ($null -eq $InputObject) {
            return
        }

        $result = $script:VsoMarkerPattern.Replace($InputObject, $evaluator)

        # The classic "##[" formatting marker (##[section], ##[error], ...) is
        # not an executable command and has no counterpart in the Node
        # filter; it is always neutralized unconditionally, as before.
        $result -replace '##\[', '##_['
    }
}
