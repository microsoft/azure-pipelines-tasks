[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $expected = 'Some secret value'
    Set-Content -LiteralPath 'Env:SECRET_Some_secret_name' -Value $expected

    # Act.
    $actual = Get-VstsTaskVariable -Name 'Some.secret.name'

    # Assert.
    Assert-AreEqual $variableSet.Expected $actual
}