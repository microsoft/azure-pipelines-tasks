[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory | ForEach-Object { $_.FullName }
    try {
        New-Item -Path $tempDirectory\my.json -ItemType File -Value @'
{
  messages: {
    "Found0Files": "Found {0:#,0.00} files.",
    "ThisIsNull0": "This is null: '{0}'.",
    "Two0Tokens1InThisString": "Two {0} tokens {1} in this string.",
    "JustAString": "Just a string. {Not a format string.}"
  }
}
'@ | ForEach-Object { $_.FullName }

        # Act/Assert.
        Import-VstsLocStrings -LiteralPath $tempDirectory\my.json
        Assert-AreEqual 'Found 123,456.00 files.' (Get-VstsLocString -Key Found0Files -ArgumentList 123456)
        Assert-AreEqual 'This is null: ''''.' (Get-VstsLocString -Key ThisIsNull0 -ArgumentList $null)
        Assert-AreEqual 'Two REPLACEMENT1 tokens REPLACEMENT2 in this string.' (Get-VstsLocString -Key Two0Tokens1InThisString -ArgumentList REPLACEMENT1, REPLACEMENT2)
        Assert-AreEqual 'Just a string. {Not a format string.}' (Get-VstsLocString -Key JustAString)
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}