[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

$invalidSourcePath = "Invalid"
Register-Mock Test-Path { return $false } -ParametersEvaluator { $LiteralPath -eq $invalidSourcePath }

Assert-Throws {
    Validate-SourcePath -value ""
} -MessagePattern "Parameter 'sourcePath' cannot be null or empty."

Assert-Throws {
    Validate-SourcePath -value "$invalidSourcePath"
} -MessagePattern "Source path '$invalidSourcePath' does not exist."