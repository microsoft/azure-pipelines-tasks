[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
$env:SECUREFILE_TICKET_10 = 'rsaticket10'
Invoke-VstsTaskScript -ScriptBlock {
    # Act.
    $actual = Get-VstsSecureFileTicket -Id '10'

    # Assert.
    Assert-IsNotNullOrEmpty $actual
    Assert-AreEqual 'rsaticket10' $actual
    Assert-IsNullOrEmpty $env:SECUREFILE_TICKET_10
}