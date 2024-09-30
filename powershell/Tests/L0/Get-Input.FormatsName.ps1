[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
$env:INPUT_Some_Name = 'Some value'
Invoke-VstsTaskScript -ScriptBlock {
    # Act.
    $actual = Get-VstsInput -Name 'Some name'

    # Assert.
    Assert-AreEqual 'Some value' $actual
    Assert-IsNullOrEmpty $env:INPUT_Some_Name
}