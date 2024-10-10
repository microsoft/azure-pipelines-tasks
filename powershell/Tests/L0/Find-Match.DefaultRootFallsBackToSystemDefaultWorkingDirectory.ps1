[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $originalSystemDefaultWorkingDirectory = $env:SYSTEM_DEFAULTWORKINGDIRECTORY
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
        # Create the following layout:
        #   hello-from-system-default-working-directory.txt
        #   world.txt
        New-Item -Path "$tempDirectory\hello-from-system-default-working-directory.txt" -ItemType File
        New-Item -Path "$tempDirectory\world.txt" -ItemType File
        $env:SYSTEM_DEFAULTWORKINGDIRECTORY = $tempDirectory
        $patterns = @(
            '**\*'
        )

        # Act.
        $actual = Find-VstsMatch -Pattern $patterns

        # Assert.
        $expected = @(
            "$tempDirectory\hello-from-system-default-working-directory.txt"
            "$tempDirectory\world.txt"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        $env:SYSTEM_DEFAULTWORKINGDIRECTORY = $originalSystemDefaultWorkingDirectory
        Remove-Item $tempDirectory -Recurse
    }
}