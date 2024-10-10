[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    if (Test-Path -LiteralPath Env:INPUT_SOME_NAME) {
        Remove-Item -LiteralPath Env:INPUT_SOME_NAME
    }

    $variableSets = @(
        @{ }
        @{ AsBool = $true }
        @{ AsInt = $true }
    )
    foreach ($variableSet in $variableSets) {
        $expected = $variableSet.Expected
        $variableSet.Remove('Expected')

        # Act.
        $actual = Get-VstsInput -Name 'Some name' -Require -ErrorAction Continue @variableSet 2>&1

        # Actual.
        Assert-IsNotNullOrEmpty $actual
        Assert-AreEqual -Expected ([System.Management.Automation.ErrorRecord]) -Actual $actual.GetType()
        Assert-AreEqual -Expected 'Required: ''Some name'' input' -Actual $actual.Exception.Message
    }
}