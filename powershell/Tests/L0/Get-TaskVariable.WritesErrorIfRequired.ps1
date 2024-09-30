[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    if (Test-Path -LiteralPath Env:SOME_NAME) {
        Remove-Item -LiteralPath Env:SOME_NAME
    }

    $variableSets = @(
        @{ }
        @{ AsBool = $true }
        @{ AsInt = $true }
    )
    foreach ($variableSet in $variableSets) {
        # Act.
        $actual = Get-VstsTaskVariable -Name 'Some name' -Require -ErrorAction Continue @variableSet 2>&1

        # Assert.
        Assert-IsNotNullOrEmpty $actual
        Assert-AreEqual -Expected ([System.Management.Automation.ErrorRecord]) -Actual $actual.GetType()
        Assert-AreEqual -Expected 'Required: ''Some name'' task variable' -Actual $actual.Exception.Message
    }
}