[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
        # Act.
        $actual = & (Get-Module VstsTaskSdk) Get-FindResult -Path "$tempDirectory\nosuch" -Options (New-VstsFindOptions)

        # Assert.
        $expected = $null
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse -Force
    }
}