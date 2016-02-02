[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
foreach ($clean in @($true, $false)) {
    foreach ($restoreNuGetPackages in @($true, $false)) {
        foreach ($logProjectEvents in @($true, $false)) {
            Unregister-Mock Get-VstsInput
            Unregister-Mock Get-SolutionFiles
            Unregister-Mock Select-VSVersion
            Unregister-Mock Select-MSBuildLocation
            Unregister-Mock Format-MSBuildArguments
            Unregister-Mock Invoke-BuildTools
            Register-Mock Get-VstsInput { 'Some input VS version' } -- -Name VSVersion
            Register-Mock Get-VstsInput { 'Some input architecture' } -- -Name MSBuildArchitecture
            Register-Mock Get-VstsInput { 'Some input arguments' } -- -Name MSBuildArgs
            Register-Mock Get-VstsInput { 'Some input solution' } -- -Name Solution -Require
            Register-Mock Get-VstsInput { 'Some input platform' } -- -Name Platform
            Register-Mock Get-VstsInput { 'Some input configuration' } -- -Name Configuration
            Register-Mock Get-VstsInput { $clean } -- -Name Clean -AsBool
            Register-Mock Get-VstsInput { $restoreNuGetPackages } -- -Name RestoreNuGetPackages -AsBool
            Register-Mock Get-VstsInput { $logProjectEvents } -- -Name LogProjectEvents -AsBool
            Register-Mock Get-SolutionFiles { 'Some solution 1', 'Some solution 2' } -- -Solution 'Some input solution'
            Register-Mock Select-VSVersion { 'Some VS version' } -- -PreferredVersion 'Some input VS version'
            Register-Mock Select-MSBuildLocation { 'Some MSBuild location' } -- -VSVersion 'Some VS version' -Architecture 'Some input architecture'
            Register-Mock Format-MSBuildArguments { 'Some formatted arguments' } -- -MSBuildArguments 'Some input arguments' -Platform 'Some input platform' -Configuration 'Some input configuration' -VSVersion 'Some VS version'
            Register-Mock Invoke-BuildTools { 'Some build output' }

            # Act.
            $output = & $PSScriptRoot\..\..\..\Tasks\VSBuild\VSBuild.ps1

            # Assert.
            Assert-AreEqual 'Some build output' $output
            Assert-WasCalled Invoke-BuildTools -- -NuGetRestore: $restoreNuGetPackages -SolutionFiles @('Some solution 1', 'Some solution 2') -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some formatted arguments' -Clean: $clean -NoTimelineLogger: $(!$logProjectEvents)
        }
    }
}
