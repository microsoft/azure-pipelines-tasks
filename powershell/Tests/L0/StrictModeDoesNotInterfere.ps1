[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    Set-StrictMode -Version Latest

    # Act.
    & (Get-Module -Name VstsTaskSdk) { $null.NoSuch }
}