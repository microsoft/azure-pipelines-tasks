[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $originalAgentVersion = $env:AGENT_VERSION
    try {
        # Arrange.
        $env:AGENT_VERSION = '2.115.2'

        # Act/Assert.
        Assert-VstsAgent -Minimum '2.104.1'
        Assert-VstsAgent -Minimum '2.115.1'
        Assert-VstsAgent -Minimum '2.115.2'
    } finally {
        $env:AGENT_VERSION = $originalAgentVersion
    }
}
