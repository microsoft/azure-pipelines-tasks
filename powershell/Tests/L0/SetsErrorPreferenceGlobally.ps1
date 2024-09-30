[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $file = $null
    try {
        # Arrange: Generate a temporary module that exposes a function to write an error record.
        $file = [System.IO.Path]::Combine(
            [System.IO.Path]::GetTempPath(),
            [System.IO.Path]::GetRandomFileName() + ".psm1")
        $content = @'
function Write-AnError {
    [CmdletBinding()]
    param()

    Write-Error 'Some error message'
}
'@
        [System.IO.File]::WriteAllText($file, $content)

        # Arrange: Import the module.
        Import-Module -Name $file

        # Act.
        try {
            Write-AnError
            throw "Not expected to reach this line"
        } catch {
            Assert-AreEqual 'Some error message' $_.Exception.Message
        }
    } finally {
        if ($file) {
            Remove-Item -LiteralPath $file
        }
    }
}