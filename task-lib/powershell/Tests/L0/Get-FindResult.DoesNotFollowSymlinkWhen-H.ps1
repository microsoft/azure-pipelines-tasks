[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
        # Create the following layout:
        #   realDir
        #   realDir/file
        #   symDir -> realDir
        New-Item -Path "$tempDirectory\realDir" -ItemType Directory
        New-Item -Path "$tempDirectory\realDir\file" -ItemType File
        & cmd.exe /S /C "mklink /J `"$tempDirectory\symDir`" `"$tempDirectory\realDir`""
        Get-Item -LiteralPath "$tempDirectory\symDir\file"
        $options = New-VstsFindOptions -FollowSpecifiedSymbolicLink # equivalent to "find -H"

        # Act.
        $actual = & (Get-Module VstsTaskSdk) Get-FindResult -Path $tempDirectory -Options $options

        # Assert.
        $expected = @(
            "$tempDirectory"
            "$tempDirectory\realDir"
            "$tempDirectory\realDir\file"
            "$tempDirectory\symDir"
        )
        Assert-AreEqual ($expected | Sort-Object) ($actual | Sort-Object)
    } finally {
        # Remove the junction folder first. Otherwise PowerShell 4 may fail recursively
        # deleting $tempDirectory.
        Remove-Item $tempDirectory\symDir -Recurse -Force -ErrorAction Ignore
        Remove-Item $tempDirectory -Recurse -Force
    }
}