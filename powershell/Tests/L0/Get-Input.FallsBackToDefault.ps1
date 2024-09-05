[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    if (Test-Path -LiteralPath Env:INPUT_SOME_NAME) {
        Remove-Item -LiteralPath Env:INPUT_SOME_NAME
    }

    $variableSets = @(
        @{ Expected = '' }
        @{ Default = 'Some default' ; Expected = 'Some default' }
        @{ AsBool = $true ; Expected = $false }
        @{ AsBool = $true ; Default = 'Not a bool' ; Expected = $false }
        @{ AsBool = $true ; Default = 'false' ; Expected = $false }
        @{ AsBool = $true ; Default = '0' ; Expected = $false }
        @{ AsBool = $true ; Default = 'true' ; Expected = $true }
        @{ AsBool = $true ; Default = '1' ; Expected = $true }
        @{ AsInt = $true ; Expected = 0 }
        @{ AsInt = $true ; Default = 'Not an int' ; Expected = 0 }
        @{ AsInt = $true ; Default = '0' ; Expected = 0 }
        @{ AsInt = $true ; Default = '123' ; Expected = 123 }
        @{ AsInt = $true ; Default = '-123.0' ; Expected = -123 }
    )
    foreach ($variableSet in $variableSets) {
        $expected = $variableSet.Expected
        $variableSet.Remove('Expected')

        # Act.
        $actual = Get-VstsInput -Name 'Some name' @variableSet

        # Assert.
        Assert-AreEqual $expected $actual
    }
}