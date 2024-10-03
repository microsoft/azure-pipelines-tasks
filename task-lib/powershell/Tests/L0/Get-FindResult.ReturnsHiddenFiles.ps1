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
        #   .emptyFolder
        #   .file
        #   .folder
        #   .folder/file
        New-Item -Path "$tempDirectory\.emptyFolder" -ItemType Directory
        New-Item -Path "$tempDirectory\.folder" -ItemType Directory
        New-Item -Path "$tempDirectory\.file" -ItemType File
        New-Item -Path "$tempDirectory\.folder\file" -ItemType File
        (Get-Item -LiteralPath "$tempDirectory\.emptyFolder").Attributes = (Get-Item -LiteralPath "$tempDirectory\.emptyFolder").Attributes -bor [System.IO.FileAttributes]::Hidden
        (Get-Item -LiteralPath "$tempDirectory\.folder").Attributes = (Get-Item -LiteralPath "$tempDirectory\.folder").Attributes -bor [System.IO.FileAttributes]::Hidden
        (Get-Item -LiteralPath "$tempDirectory\.file").Attributes = (Get-Item -LiteralPath "$tempDirectory\.file").Attributes -bor [System.IO.FileAttributes]::Hidden
        $options = New-VstsFindOptions

        # Act.
        $actual = & (Get-Module VstsTaskSdk) Get-FindResult -Path $tempDirectory -Options $options

        # Assert.
        $expected = @(
            "$tempDirectory"
            "$tempDirectory\.emptyFolder"
            "$tempDirectory\.folder"
            "$tempDirectory\.file"
            "$tempDirectory\.folder\file"
        )
        Assert-AreEqual ($expected | Sort-Object) ($actual | Sort-Object)
    } finally {
        Remove-Item $tempDirectory -Recurse -Force
    }
}