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
        "SomeString": "Some string.",
        "NotInCultureSpecificFile": "This string is not in the culture-specific file."
    }
}
'@ | ForEach-Object { $_.FullName }
        $env:SYSTEM_CULTURE = 'de-DE'
        $null = [System.IO.Directory]::CreateDirectory("$tempDirectory\Strings\resources.resjson\de-DE")
        New-Item -Path $tempDirectory\Strings\resources.resjson\de-DE\resources.resjson -ItemType File -Value @'
{
    "loc.messages.SomeString": "Culture-specific version of the string.",
    "loc.messages.OnlyInCultureSpecificFile": "This string is only in the culture-specific file."
}
'@ | ForEach-Object { $_.FullName }

        # Act/Assert.
        Import-VstsLocStrings -LiteralPath $tempDirectory\my.json
        Assert-AreEqual 'Culture-specific version of the string.' (Get-VstsLocString -Key SomeString)
        Assert-AreEqual 'This string is not in the culture-specific file.' (Get-VstsLocString -Key NotInCultureSpecificFile)
        Assert-AreEqual 'This string is only in the culture-specific file.' (Get-VstsLocString -Key OnlyInCultureSpecificFile)
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}