[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1
. $PSScriptRoot\..\Utility.ps1
$doNotSkipCACheckOption = ''

Register-Mock Register-Environment { return GetEnvironmentWithAzureProvider $environmentWithSkipCASet } -ParametersEvaluator { $EnvironmentName -eq $environmentWithSkipCASet }
$environment = Register-Environment -EnvironmentName $environmentWithSkipCASet
Register-Mock Get-EnvironmentProperty { $environmentWinRMHttpsPort} -ParametersEvaluator { $Environment.Name -eq $environmentWithSkipCASet }

Get-SkipCACheckOption -environmentName $environmentWithSkipCASet

Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator { $Environment.Name -eq $environmentWithSkipCASet }