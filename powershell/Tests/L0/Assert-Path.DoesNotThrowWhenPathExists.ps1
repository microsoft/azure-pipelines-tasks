[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory | ForEach-Object { $_.FullName }
    try {
        $directory = (New-Item -Path $tempDirectory\SomeDir -ItemType Directory).FullName
        $file = (New-Item -Path $tempDirectory\SomeFile.txt -ItemType File).FullName
        $variableSets = @(
            @{ Expected = $null ; Splat = @{ LiteralPath = $directory } }
            @{ Expected = $null ; Splat = @{ LiteralPath = $directory ; PathType = 'Any' } }
            @{ Expected = $null ; Splat = @{ LiteralPath = $directory ; PathType = 'Container' } }
            @{ Expected = $directory ; Splat = @{ LiteralPath = $directory ; PassThru = $true } }
            @{ Expected = $directory ; Splat = @{ LiteralPath = $directory ; PathType = 'Any' ; PassThru = $true } }
            @{ Expected = $directory ; Splat = @{ LiteralPath = $directory ; PathType = 'Container' ; PassThru = $true } }
            @{ Expected = $null ; Splat = @{ LiteralPath = $file } }
            @{ Expected = $null ; Splat = @{ LiteralPath = $file ; PathType = 'Any' } }
            @{ Expected = $null ; Splat = @{ LiteralPath = $file ; PathType = 'Leaf' } }
            @{ Expected = $file ; Splat = @{ LiteralPath = $file ; PassThru = $true } }
            @{ Expected = $file ; Splat = @{ LiteralPath = $file ; PathType = 'Any' ; PassThru = $true } }
            @{ Expected = $file ; Splat = @{ LiteralPath = $file ; PathType = 'Leaf' ; PassThru = $true } }
        )
        foreach ($variableSet in $variableSets) {
            $splat = $variableSet.Splat

            # Act.
            $actual = Assert-VstsPath @splat

            # Assert.
            Assert-AreEqual $variableSet.Expected $actual
        }
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}
