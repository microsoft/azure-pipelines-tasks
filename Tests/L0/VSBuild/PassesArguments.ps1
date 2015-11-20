[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Convert-String { [bool]::Parse($args[0]) }
Register-Mock Get-SolutionFiles { 'Some solution 1', 'Some solution 2' } -- -Solution 'Some input solution'
Register-Mock Select-VSVersion { 'Some VS version' } -- -PreferredVersion 'Some input VS version'
Register-Mock Select-MSBuildLocation { 'Some MSBuild location' } -- -VSVersion 'Some VS version' -Architecture 'Some input architecture'
Register-Mock Format-MSBuildArguments { 'Some formatted arguments' } -- -MSBuildArguments 'Some input arguments' -Platform 'Some input platform' -Configuration 'Some input configuration' -VSVersion 'Some VS version'
Register-Mock Invoke-BuildTools { 'Some build output' }
foreach ($clean in @($true, $false)) {
    foreach ($restoreNuGetPackages in @($true, $false)) {
        foreach ($logProjectEvents in @($true, $false)) {
            # Act.
            $splat = @{
                'VSLocation' = ''
                'VSVersion' = 'Some input VS version'
                'MSBuildLocation' = ''
                'MSBuildVersion' = ''
                'MSBuildArchitecture' = 'Some input architecture'
                'MSBuildArgs' = 'Some input arguments' 
                'Solution' = 'Some input solution' 
                'Platform' = 'Some input platform'
                'Configuration' = 'Some input configuration'
                'Clean' = $clean.ToString()
                'RestoreNuGetPackages' = $restoreNuGetPackages.ToString()
                'LogProjectEvents' = $logProjectEvents.ToString()
                'OmitDotSource' = 'true'
            }
            $output = & $PSScriptRoot\..\..\..\Tasks\VSBuild\VSBuild.ps1 @splat

            # Assert.
            Assert-AreEqual 'Some build output' $output
            Assert-WasCalled Invoke-BuildTools -- -NuGetRestore: $restoreNuGetPackages -SolutionFiles @('Some solution 1', 'Some solution 2') -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some formatted arguments' -Clean: $clean -NoTimelineLogger: $(!$logProjectEvents)
        }
    }
}
