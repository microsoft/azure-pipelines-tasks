# For more information on the Azure Pipelines Task SDK:
# https://github.com/Microsoft/vsts-task-lib

[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    # Import the localized strings.
    Import-VstsLocStrings "$PSScriptRoot\task.json"

    # Import helper modules
    Find-VstsFiles -LiteralDirectory $PSScriptRoot -LegacyPattern "*.psm1" | ForEach { Import-Module $_ }

    $updateType = (Get-VstsInput -Name updateType -Require)
    if ($updateType -eq "Manifest versions")
    {
        Update-ApplicationVersions
    }
    elseif ($updateType -eq "Docker image settings")
    {
        Update-DockerImageSettings
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}