[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory | ForEach-Object { $_.FullName }
    try {
        $directory = New-Item -Path $tempDirectory\SomeDir -ItemType Directory
        $file = New-Item -Path $tempDirectory\SomeFile.txt -ItemType File
        $noSuchPath = "$tempDirectory\NoSuch"
        $variableSets = @(
            @{ LiteralPath = $NoSuchPath ; MessagePattern = "*path*not*found*$noSuchPath*" }
            @{ LiteralPath = $NoSuchPath ; PathType = 'Any' ; MessagePattern = "*path*not*found*$noSuchPath*" }
            @{ LiteralPath = $NoSuchPath ; PathType = 'Container' ; MessagePattern = "*container*path*not*found*$noSuchPath*" }
            @{ LiteralPath = $NoSuchPath ; PathType = 'Leaf' ; MessagePattern = "*leaf*path*not*found*$noSuchPath*" }
            @{ LiteralPath = $directory.FullName ; PathType = 'Leaf' ; MessagePattern = "*leaf*path*not*found*$($directory.FullName)*" }
            @{ LiteralPath = $file.FullName ; PathType = 'Container' ; MessagePattern = "*container*path*not*found*$($file.FullName)*" }
        )
        foreach ($variableSet in $variableSets) {
            $messagePattern = $variableSet.MessagePattern
            $variableSet.Remove('MessagePattern')

            # Act/Assert.
            Assert-Throws { Assert-VstsPath @variableSet } -MessagePattern $messagePattern
        }
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}