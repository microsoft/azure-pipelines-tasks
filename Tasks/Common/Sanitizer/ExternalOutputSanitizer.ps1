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
# This function does not try to tell "safe" and "dangerous" commands apart; it
# unconditionally rewrites every marker occurrence so it can no longer be
# parsed as a command. This mirrors the default-deny design of the
# azure-pipelines-task-lib Node SDK's external-output filter
# (MarkerFilter in externaloutput.ts), ported here for PowerShell tasks that
# print raw external output instead of piping it through that SDK.
#
# Only pass text that originates outside the task's own control through this
# function. Never pass the task's own literal "##vso[...]" strings (for
# example a task.uploadfile or task.setVariable call the task emits itself)
# through it - those are trusted and must remain unescaped so the agent still
# executes them.
function Protect-ExternalOutput {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(ValueFromPipeline = $true)]
        [AllowNull()]
        [AllowEmptyString()]
        [string] $InputObject
    )

    process {
        if ($null -eq $InputObject) {
            return
        }

        # Case-insensitive on purpose: the goal is to neutralize every
        # occurrence a reasonable agent implementation could recognize, not to
        # match one specific casing. Over-neutralizing untrusted output has no
        # downside here.
        ($InputObject -replace '##vso\[', '##_vso[') -replace '##\[', '##_['
    }
}
