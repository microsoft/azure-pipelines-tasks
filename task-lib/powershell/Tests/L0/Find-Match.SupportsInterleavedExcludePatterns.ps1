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
        #   solution1\proj1\proj1.proj
        #   solution1\proj1\README.txt
        #   solution1\proj2\proj2.proj
        #   solution1\proj2\README.txt
        #   solution1\solution1.sln
        #   solution2\proj1\proj1.proj
        #   solution2\proj1\README.txt
        #   solution2\proj2\proj2.proj
        #   solution2\proj2\README.txt
        #   solution2\solution2.sln
        New-Item -Path "$tempDirectory\solution1\proj1" -ItemType Directory
        New-Item -Path "$tempDirectory\solution1\proj2" -ItemType Directory
        New-Item -Path "$tempDirectory\solution2\proj1" -ItemType Directory
        New-Item -Path "$tempDirectory\solution2\proj2" -ItemType Directory
        New-Item -Path "$tempDirectory\solution1\proj1\proj1.proj" -ItemType File
        New-Item -Path "$tempDirectory\solution1\proj1\README.txt" -ItemType File
        New-Item -Path "$tempDirectory\solution1\proj2\proj2.proj" -ItemType File
        New-Item -Path "$tempDirectory\solution1\proj2\README.txt" -ItemType File
        New-Item -Path "$tempDirectory\solution1\solution1.sln" -ItemType File
        New-Item -Path "$tempDirectory\solution2\proj1\proj1.proj" -ItemType File
        New-Item -Path "$tempDirectory\solution2\proj1\README.txt" -ItemType File
        New-Item -Path "$tempDirectory\solution2\proj2\proj2.proj" -ItemType File
        New-Item -Path "$tempDirectory\solution2\proj2\README.txt" -ItemType File
        New-Item -Path "$tempDirectory\solution2\solution2.sln" -ItemType File
        $patterns = @(
            "$tempDirectory\**\@(*.proj|README.txt)"    # include all proj and README files
            "!$tempDirectory\**\solution2\**"           # exclude the solution 2 folder entirely
            "$tempDirectory\**\*.sln"                   # include all sln files
            "!$tempDirectory\**\proj2\README.txt"       # exclude proj2 README files
        )

        # Act.
        $actual = Find-VstsMatch -Pattern $patterns

        # Assert.
        $expected = @(
            "$tempDirectory\solution1\proj1\proj1.proj"
            "$tempDirectory\solution1\proj1\README.txt"
            "$tempDirectory\solution1\proj2\proj2.proj"
            "$tempDirectory\solution1\solution1.sln"
            "$tempDirectory\solution2\solution2.sln"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}