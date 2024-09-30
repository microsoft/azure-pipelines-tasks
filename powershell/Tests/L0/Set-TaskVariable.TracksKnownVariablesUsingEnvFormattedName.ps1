[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    # Arrange.
    Set-VstsTaskVariable -Name 'Some.Public.Var' -Value 'Some value'

    # Act.
    Set-VstsTaskVariable -Name 'Some_public.VAR' -Value 'Some new value'

    # Assert.
    $vars = @( Get-VstsTaskVariableInfo )
    Assert-AreEqual 1 $vars.Count
    Assert-AreEqual 'Some_public.VAR' $vars[0].Name
    Assert-AreEqual 'Some new value' $vars[0].Value
    Assert-AreEqual $false $vars[0].Secret
}