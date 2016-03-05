[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

# Load up the VsTest helpers suite
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1
$testCases = @{"(Base case) Debug ARM is skipped"=@{
                   p="ARM";c="Debug";r=$true
               };
                "(Base case) Release ARM is skipped"=@{
                   p="ARM";c="Release";r=$true
               };
                "(Base case) Profile x86 is skipped"=@{
                   p="x86";c="Profile";r=$true
               };
                "(Base case) Release x86 is not skipped"=@{
                   p="x86";c="Release";r=$false
               };
                "(Case sensitivity) pROfiLe X86 is skipped"=@{
                   p="X86";c="pROfiLe";r=$true
               };
                "(Invalid param) Release 'no platform given' is not skipped"=@{
                   p="";c="Release";r=$false
               };
                "(Invalid param) 'no config given' ARM is not skipped"=@{
                   p="ARM";c="";r=$false
               };
              }

$skipPlatConfig="Debug|ARM,Release|ARM,Profile|x86"
$testCases.Keys | ForEach-Object {
    
    Write-Verbose "Test case ""$PSItem"":"
    $testPlatform = $testCases[$PSItem].p
    $testConfig = $testCases[$PSItem].c
    $expectedResult = $testCases[$PSItem].r
    Write-Verbose "   platform:$testPlatform"
    Write-Verbose "   config:$testConfig"
    Write-Verbose "   expectedResult:$expectedResult"
        
    $skip = SkipTestsForConfigurationPlatform -skipConfigPlatformPermutations $skipPlatConfig -config $testConfig -platform $testPlatform
    
    Write-Verbose "Actual output from check function: $skip"
    
    Assert-AreEqual $skip $expectedResult
}

# Ensure the actual VsTest.ps1 script also exits early
Register-Mock Get-TaskVariable { $sourcesDirectory } -- -Context $distributedTaskContext -Name "Build.SourcesDirectory"

$splat = @{
    'vsTestVersion' = 'vsTestVersion'
    'testAssembly' = 'bogustestassembly' 
    'testFiltercriteria' = 'testFiltercriteria' 
    'runSettingsFile' = 'runSettingsFile' 
    'codeCoverageEnabled' = 'codeCoverageEnabled'
    'pathtoCustomTestAdapters' = 'pathtoCustomTestAdapters'
    'overrideTestrunParameters' = 'overrideTestrunParameters'
    'otherConsoleOptions' = 'otherConsoleOptions'
    'testRunTitle' = 'testRunTitle'
    'platform' = 'ARM'
    'configuration' = 'Debug'
    'publishRunAttachments' = 'publishRunAttachments'
    'runInParallel' = 'runInParallel'
    'skipConfigurationPlatform' = $skipPlatConfig
}

& $PSScriptRoot\..\..\..\Tasks\VsTest\VsTest.ps1 @splat

Assert-WasCalled Get-TaskVariable -Times 0
