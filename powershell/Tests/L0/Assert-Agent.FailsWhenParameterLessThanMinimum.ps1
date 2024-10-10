[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $originalAgentVersion = $env:AGENT_VERSION
    try {
        # Arrange.
        $env:AGENT_VERSION = '2.115.0'

        # Act.
        $actual = Assert-VstsAgent -Minimum '2.104.0' -ErrorAction 'Continue' 2>&1

        # Assert.
        Assert-IsNotNullOrEmpty $actual
        Assert-AreEqual -Expected ([System.Management.Automation.ErrorRecord]) -Actual $actual.GetType()
        Assert-AreEqual -Expected 'Assert-Agent requires the parameter to be 2.104.1 or higher.' -Actual $actual.Exception.Message
    } finally {
        $env:AGENT_VERSION = $originalAgentVersion
    }
}
