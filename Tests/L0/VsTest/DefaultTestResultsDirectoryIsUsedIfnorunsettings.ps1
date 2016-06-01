[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

Register-Mock Get-TaskVariable { "c:\testSource" }
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
	$TestResultsFolder -eq 'c:\testSource\TestResults'
}