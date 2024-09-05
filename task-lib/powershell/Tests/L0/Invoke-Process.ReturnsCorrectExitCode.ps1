[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
$Global:LASTEXITCODE = 1

Invoke-VstsTaskScript -ScriptBlock {

    # Act.
    $actualEC = Invoke-VstsProcess -FileName 'cmd.exe' -Arguments '/c echo test'

    # Assert.
    Assert-AreEqual -Expected 0 -Actual $actualEC
    Assert-AreEqual 0 $LASTEXITCODE
}
