[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-TaskVariable { "c:\testSource" }
Register-Mock Convert-String { $true }
Register-Mock Find-Files { $true }
Register-Mock Invoke-VSTest { $true } -- -TestAssemblies @("c:\test1.dll","c:\test2;.dll","c:\test3.dll") -VSTestVersion "vsTestVersion" -TestFiltercriteria "testFiltercriteria" -RunSettingsFile "runSettingsFile" -PathtoCustomTestAdapters "pathtoCustomTestAdapters" -CodeCoverageEnabled $true -OverrideTestrunParameters "overrideTestrunParameters" -OtherConsoleOptions "otherConsoleOptions" -WorkingFolder "c:\testSource" -TestResultsFolder "c:\testSource\TestResults" -SourcesDirectory "c:\testSource"
Register-Mock Publish-TestResults { $true }

$splat = @{
    'vsTestVersion' = 'vsTestVersion'
    'testAssembly' = 'c:\test1.dll;c:\test2;;.dll;c:\test3.dll' 
    'testFiltercriteria' = 'testFiltercriteria' 
    'runSettingsFile' = 'runSettingsFile' 
    'codeCoverageEnabled' = 'true'
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

Assert-WasCalled Invoke-VSTest -Times 1
Assert-WasCalled Publish-TestResults  -Times 1
