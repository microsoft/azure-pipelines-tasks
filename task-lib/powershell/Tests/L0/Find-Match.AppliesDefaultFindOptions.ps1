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
        #   hello/hello.txt
        #   world -> hello
        New-Item -Path "$tempDirectory\hello" -ItemType Directory
        New-Item -Path "$tempDirectory\hello\hello.txt" -ItemType File
        & cmd.exe /S /C "mklink /J `"$tempDirectory\world`" `"$tempDirectory\hello`""
        $patterns = @(
            '**\*'
        )

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns

        # Assert.
        $expected = @(
            "$tempDirectory\hello"
            "$tempDirectory\hello\hello.txt"
            "$tempDirectory\world"
            "$tempDirectory\world\hello.txt"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        # Remove the junction folder first. Otherwise PowerShell 4 may fail recursively
        # deleting $tempDirectory.
        Remove-Item $tempDirectory\world -Recurse -Force -ErrorAction Ignore
        Remove-Item $tempDirectory -Recurse -Force
    }
}