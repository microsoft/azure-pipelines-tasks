[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return "FILEPATH" } -- -Name targetType 
Register-Mock Get-VstsInput { return "path/to/script.ps1" } -- -Name filePath 
Register-Mock Get-VstsInput { return "/fakecwd" } -- -Name workingDirectorys
Register-Mock Get-VstsInput { return $true } -- -Name useCallOperator -AsBool
Register-Mock Get-VstsInput { return $true } -- -Name showWarnings -AsBool

# Register-Mock Assert-VstsPath
# Register-Mock Test-Path { $true } -- "path/to/script.ps1"
# Register-Mock Test-Path { $true } -- "/fakecwd"
# Register-Mock Test-Path { $true } -- "temp/path"
# Register-Mock Test-Path { $true } -- "path/to/powershell"


# Register-Mock Assert-VstsAgent { $true } -- "2.115.0"

# Register-Mock Get-VstsTaskVariable { "temp/path" } -- -Name agent.tempDirectory

# Register-Mock Get-Command { return "path/to/powershell" }
# Register-Mock Invoke-VstsTool

# Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $environmentWithSkipCANotSet  } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
# Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
# Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpPort } -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $resourceWinRMHttpPortKeyName}

$output = & $PSScriptRoot\..\powershell.ps1

Assert-AreEqual 'Some build output' $output
