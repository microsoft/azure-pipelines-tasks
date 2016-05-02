[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$testAssembly='testAssembly.dll'
Register-Mock Get-LocalizedString { } -- -Key "No results found to publish."
Register-Mock Get-LocalizedString 
Register-Mock Write-Warning

$sourcesDirectory = 'c:\temp'
$distributedTaskContext = 'Some distributed task context'
Register-Mock Get-TaskVariable { $sourcesDirectory } -- -Context $distributedTaskContext -Name "Build.SourcesDirectory"
Register-Mock Get-TaskVariable { $sourcesDirectory } -- -Context $distributedTaskContext -Name "System.ArtifactsDirectory" -Global $FALSE

Register-Mock Find-Files { $true } -- -SearchPattern $testAssembly -RootFolder $sourcesDirectory
$testResultsDirectory=$sourcesDirectory + [System.IO.Path]::DirectorySeparatorChar + "TestResults"
Register-Mock Find-Files { $false } -- -SearchPattern "*.trx" -RootFolder $testResultsDirectory

Register-Mock Convert-String { $true }

Register-Mock Publish-TestResults
Register-Mock Invoke-VsTest
Register-Mock IsVisualStudio2015Update1OrHigherInstalled
Register-Mock SetupRunSettingsFileForParallel

$splat = @{
	'vsTestVersion' = 'vsTestVersion'
	'testAssembly' = $testAssembly 
	'testFiltercriteria' = 'testFiltercriteria' 
	'runSettingsFile' = 'runSettingsFile' 
	'codeCoverageEnabled' = 'codeCoverageEnabled'
	'pathtoCustomTestAdapters' = 'pathtoCustomTestAdapters'
	'overrideTestrunParameters' = 'overrideTestrunParameters'
	'otherConsoleOptions' = 'otherConsoleOptions'
	'testRunTitle' = 'testRunTitle'
	'platform' = 'platform'
	'configuration' = 'configuration'
	'publishRunAttachments' = 'publishRunAttachments'
	'runInParallel' = 'runInParallel'
}
& $PSScriptRoot\..\..\..\Tasks\VsTest\VsTest.ps1 @splat

Assert-WasCalled Find-Files -Times 1
Assert-WasCalled IsVisualStudio2015Update1OrHigherInstalled -Times 0
Assert-WasCalled Publish-TestResults -Times 0
Assert-WasCalled Invoke-VsTest -Times 1
Assert-WasCalled Get-LocalizedString -Times 1
