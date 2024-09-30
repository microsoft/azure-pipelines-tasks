[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    # Arrange.
    $env:SOME_VAR = 'Some value'

    # Act.
    Set-VstsTaskVariable -Name 'Some.Var' -Value 'Some new value' -Secret

    # Assert.
    Assert-AreEqual $null $env:SOME_VAR
}