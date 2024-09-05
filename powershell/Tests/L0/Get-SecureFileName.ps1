[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
$env:SECUREFILE_NAME_10 = 'securefile10.p12'

Invoke-VstsTaskScript -ScriptBlock {
    # Act.
    $actual = Get-VstsSecureFileName -Id '10'

    # Assert.
    Assert-IsNotNullOrEmpty $actual
    Assert-AreEqual 'securefile10.p12' $actual

    Assert-IsNullOrEmpty $env:SECUREFILE_NAME_10
}