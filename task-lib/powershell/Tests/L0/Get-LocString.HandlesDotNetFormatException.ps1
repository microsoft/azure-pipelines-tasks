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
        "Malformed": "Malformed format string {one}",
        "One0Token": "One {0} token.",
        "Two0Tokens1": "Two {0} tokens {1}."
    }
}
'@ | ForEach-Object { $_.FullName }
        Import-VstsLocStrings -LiteralPath $tempDirectory\my.json
        $variableSets = @(
            @{ Expected = 'Malformed format string {one} STR1' ; Key = 'Malformed' ; ArgumentList = 'STR1' }
            @{ Expected = 'Malformed format string {one} STR1 STR2' ; Key = 'Malformed' ; ArgumentList = 'STR1', 'STR2' }
            @{ Expected = 'Two {0} tokens {1}. STR1' ; Key = 'Two0Tokens1' ; ArgumentList = 'STR1' }
        )
        foreach ($variableSet in $variableSets) {
            Unregister-Mock Write-Warning
            Register-Mock Write-Warning

            # Act.
            $actual = Get-VstsLocString -Key $variableSet.Key -ArgumentList $variableSet.ArgumentList

            # Assert.
            Assert-AreEqual $variableSet.Expected $actual
            Assert-WasCalled Write-Warning -- "String format failed."
        }
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}