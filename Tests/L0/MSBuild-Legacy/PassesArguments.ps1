[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Convert-String { [bool]::Parse($args[0]) }
Register-Mock Get-SolutionFiles { 'Some solution 1', 'Some solution 2' } -- -Solution 'Some input solution'
Register-Mock Format-MSBuildArguments { 'Some formatted arguments' } -- -MSBuildArguments 'Some input arguments' -Platform 'Some input platform' -Configuration 'Some input configuration'
foreach ($clean in @($true, $false)) {
    foreach ($restoreNuGetPackages in @($true, $false)) {
        foreach ($logProjectEvents in @($true, $false)) {
            Unregister-Mock Select-MSBuildLocation
            Unregister-Mock Invoke-BuildTools
            Register-Mock Select-MSBuildLocation { 'Some location' } -- -Method 'Some input method' -Location 'Some input location' -Version 'Some input version' -Architecture 'Some input architecture'
            Register-Mock Invoke-BuildTools { 'Some build output' }

            # Act.
            $splat = @{
                'MSBuildLocationMethod' = 'Some input method'
                'MSBuildLocation' = 'Some input location' 
                'MSBuildArguments' = 'Some input arguments' 
                'Solution' = 'Some input solution' 
                'Platform' = 'Some input platform'
                'Configuration' = 'Some input configuration'
                'Clean' = $clean.ToString()
                'RestoreNuGetPackages' = $restoreNuGetPackages.ToString()
                'LogProjectEvents' = $logProjectEvents.ToString()
                'MSBuildVersion' = 'Some input version'
                'MSBuildArchitecture' = 'Some input architecture'
                'OmitDotSource' = 'true'
            }
            $output = & $PSScriptRoot\..\..\..\Tasks\MSBuild\MSBuild.ps1 @splat

            # Assert.
            Assert-AreEqual 'Some build output' $output
            Assert-WasCalled Invoke-BuildTools -- -NuGetRestore: $restoreNuGetPackages -SolutionFiles @('Some solution 1', 'Some solution 2') -MSBuildLocation 'Some location' -MSBuildArguments 'Some formatted arguments' -Clean: $clean -NoTimelineLogger: $(!$logProjectEvents)
        }
    }
}
