[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$now = Get-Date
$env:Build_BuildUri = 'Some build URI'
$env:Build_BuildNumber = 'Some build number'
$env:Build_Repository_Name = 'Some build repository name'
$env:Build_Repository_Uri = 'Some build repository URI'
$env:System_TeamProject = 'Some team project'
$env:System_TeamFoundationCollectionUri = 'Some team foundation collection URI'
Register-Mock Get-Date { $now }
Register-Mock Get-VstsTaskVariable
Register-Mock Find-VstsMatch { 'Some PDB file 1', 'Some PDB file 2' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols
Register-Mock Invoke-UnpublishSymbols
Register-Mock Get-VstsInput { 'FileShare' } -ParametersEvaluator { $Name -eq 'SymbolServerType' }
Register-Mock Get-VstsInput { $true } -ParametersEvaluator { $Name -eq 'IndexSources' }
Register-Mock Get-VstsInput { '123' } -- -Name 'SymbolsMaximumWaitTime' -Default '0' -AsInt
Register-Mock Get-VstsInput { $true } -- -Name 'Delete' -AsBool
Register-Mock Get-VstsInput { 'Some input symbols path' } -- -Name 'SymbolsPath' -Require
Register-Mock Get-VstsInput { 'Some transaction ID' } -- -Name 'TransactionId' -Require
$env:PublishSymbols_Debug = $null

# Act.
& $PSScriptRoot\..\PublishSymbols.ps1

# Assert.
Assert-WasCalled Invoke-IndexSources -Times 0
Assert-WasCalled Invoke-PublishSymbols -Times 0
$semaphoreMessage = "Unpublish: True, Machine: $env:ComputerName, BuildUri: Some build URI, BuildNumber: Some build number, RepositoryName: Some build repository name, RepositoryUri: Some build repository URI, Team Project: Some team project, CollectionUri: Some team foundation collection URI at $($now.ToUniversalTime()) UTC"
Assert-WasCalled Invoke-UnpublishSymbols -- -Share 'Some input symbols path' -TransactionId 'Some transaction ID' -MaximumWaitTime ([timespan]::FromMinutes(123)) -SemaphoreMessage $semaphoreMessage
