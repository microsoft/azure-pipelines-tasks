[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$sourcesDirectory = 'c:\temp'
$workingDirectory = 'c:\temp'
$testResultsDirectory = $workingDirectory + [System.IO.Path]::DirectorySeparatorChar + "TestResults"
Register-Mock Get-TaskVariable { $sourcesDirectory } -- -Context $distributedTaskContext -Name "Build.SourcesDirectory"
Register-Mock Get-TaskVariable { $workingDirectory } -- -Context $distributedTaskContext -Name "Agent.BuildDirectory"
Register-Mock Get-TaskVariable { $testResultsDirectory } -- -Context $distributedTaskContext -Name "Common.TestResultsDirectory"
Register-Mock Convert-String { $true }
Register-Mock Find-Files { $true }
Register-Mock CmdletHasMember { $true }
Register-Mock Publish-TestResults { $true }
Register-Mock Invoke-VSTest { $true }


$input = @{
'vsTestVersion'='14.0'
'testAssembly'='asd.dll'
'testFiltercriteria'=''
'runSettingsFile'=''
'codeCoverageEnabled'='false'
'pathtoCustomTestAdapters'=''
'overrideTestrunParameters'='asd'
'otherConsoleOptions'=''
'testRunTitle'=''
'platform'=''
'configuration'=''
'publishRunAttachments'='true'
'runInParallel'='false'
}
& $PSScriptRoot\..\..\..\Tasks\VsTest\VSTest.ps1 @input

Assert-WasCalled Invoke-VSTest -ParametersEvaluator {
	$TestResultsFolder -eq $testResultsDirectory
}