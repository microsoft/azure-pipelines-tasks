[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $originalAgentVersion = $env:AGENT_VERSION
    try {
        # Arrange.
        $env:AGENT_VERSION = '2.114.1'

        # Act.
        $actual = Assert-VstsAgent -Minimum '2.114.2' -ErrorAction 'Continue' 2>&1

        # Assert.
        Assert-IsNotNullOrEmpty $actual
        Assert-AreEqual -Expected ([System.Management.Automation.ErrorRecord]) -Actual $actual.GetType()
        Assert-AreEqual -Expected 'Agent version 2.114.2 or higher is required.' -Actual $actual.Exception.Message
    } finally {
        $env:AGENT_VERSION = $originalAgentVersion
    }
}
