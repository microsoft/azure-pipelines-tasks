# Neutralizes "##vso[...]" and "##[...]" logging-command markers in untrusted
# external output (e.g. SQL query results) so they can't be executed as agent
# commands. Shared so other tasks printing untrusted external output can reuse it.
function Protect-ExternalOutput {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(ValueFromPipeline = $true)]
        [AllowNull()]
        [AllowEmptyString()]
        [string] $InputObject,

        # Documentation/telemetry only; does not affect filtering.
        [Parameter(Mandatory = $true)]
        [ValidateSet('remote', 'childProcess', 'repository')]
        [string] $Source
    )

    process {
        if ($null -eq $InputObject) {
            return
        }

        ($InputObject -replace '##vso\[', '##_vso[') -replace '##\[', '##_['
    }
}
