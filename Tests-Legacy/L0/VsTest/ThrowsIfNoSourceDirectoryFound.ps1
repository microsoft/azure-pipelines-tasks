[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable

# Act/Assert.
Assert-Throws {             
	# Act.
	$splat = @{
		'vsTestVersion' = 'vsTestVersion'
		'testAssembly' = 'testAssembly' 
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
		'$runInParallel' = '$runInParallel'
	}
	& $PSScriptRoot\..\..\..\Tasks\VsTest\VsTest.ps1 @splat
}