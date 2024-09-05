[CmdletBinding()]
param()

# Arrange.
$env:SYSTEM_CULTURE = 'de-DE'
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $stringsFile = "$PSScriptRoot\mystrings.json"
    Register-Mock Test-Path { $true }

    # Mock the fallback content.
    Register-Mock Get-Content {
        '{ "messages": { "SomeFallbackString": "Some fallback string value" } }'
    } -- -LiteralPath $stringsFile -Encoding UTF8

    # Mock the culture-specific content.
    Register-Mock Get-Content {
        ' { "loc.messages.SomeCultureSpecificString": "Some culture-specific string value" }'
    } -- -LiteralPath "$PSScriptRoot\Strings\resources.resjson\de-DE\resources.resjson" -Encoding UTF8

    # Act.
    Import-VstsLocStrings -LiteralPath $PSScriptRoot\mystrings.json

    # Assert.
    # The UTF8 encoding must be explicitly specified when reading the content of the file.
    # Otherwise parsing will fail on non-Latin cultures when the byte-order-mark is not present.
    Assert-AreEqual 'Some fallback string value' (Get-VstsLocString -Key SomeFallbackString)
    Assert-AreEqual 'Some culture-specific string value' (Get-VstsLocString -Key SomeCultureSpecificString)
}