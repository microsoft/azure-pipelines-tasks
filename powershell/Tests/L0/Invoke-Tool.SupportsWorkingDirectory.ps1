[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $originalLocation = $PWD
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory | ForEach-Object { $_.FullName }
    try {
        Set-Location $env:TMP
        $variableSets = @(
            @{ Expected = [System.IO.Path]::GetTempPath().TrimEnd('\') ; Splat = @{ } }
            @{ Expected = [System.IO.Path]::GetTempPath().TrimEnd('\') ; Splat = @{ WorkingDirectory = [System.IO.Path]::GetTempPath() } }
            @{ Expected = $tempDirectory ; Splat = @{ WorkingDirectory = $tempDirectory } }
        )
        foreach ($variableSet in $variableSets) {
            $splat = $variableSet.Splat

            # Act.
            $actual = Invoke-VstsTool -FileName 'cmd.exe' -Arguments '/c "CD"' @splat

            # Assert.
            Assert-AreEqual $variableSet.Expected $actual
            Assert-AreEqual ([System.IO.Path]::GetTempPath().TrimEnd('\')) (Get-Location).Path
        }
    } finally {
        Set-Location $originalLocation
        Remove-Item $tempDirectory -Recurse
    }
}