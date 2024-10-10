[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    # Arrange.
    Set-VstsTaskVariable -Name 'Some.Var' -Value 'Some public value'

    # Act.
    Set-VstsTaskVariable -Name 'Some.Var' -Value 'Some new value' -Secret

    # Assert.
    $vars = @( Get-VstsTaskVariableInfo )
    Assert-AreEqual 1 $vars.Count
    Assert-AreEqual 'Some.Var' $vars[0].Name
    Assert-AreEqual 'Some new value' $vars[0].Value
    Assert-AreEqual $true $vars[0].Secret
}