[cmdletbinding()]
param()
<#
[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"
    [string]$msBuildLocationMethod = Get-VstsInput -Name MSBuildLocationMethod
    [string]$msBuildLocation = Get-VstsInput -Name MSBuildLocation
    [string]$msBuildArguments = Get-VstsInput -Name MSBuildArguments
    [string]$solution = Get-VstsInput -Name Solution -Require
    [string]$platform = Get-VstsInput -Name Platform
    [string]$configuration = Get-VstsInput -Name Configuration
    [bool]$clean = Get-VstsInput -Name Clean -AsBool
    [bool]$restoreNuGetPackages = Get-VstsInput -Name RestoreNuGetPackages -AsBool
    [bool]$logProjectEvents = Get-VstsInput -Name LogProjectEvents -AsBool
    [string]$msBuildVersion = Get-VstsInput -Name MSBuildVersion
    [string]$msBuildArchitecture = Get-VstsInput -Name MSBuildArchitecture
    . $PSScriptRoot\Select-MSBuildLocation_PS3.ps1
    Import-Module -Name $PSScriptRoot\MSBuildHelpers\MSBuildHelpers.psm1
    $solutionFiles = Get-SolutionFiles -Solution $solution
    $msBuildArguments = Format-MSBuildArguments -MSBuildArguments $msBuildArguments -Platform $platform -Configuration $configuration
    $msBuildLocation = Select-MSBuildLocation -Method $msBuildLocationMethod -Location $msBuildLocation -Version $msBuildVersion -Architecture $msBuildArchitecture
    $ErrorActionPreference = 'Continue'
    Invoke-BuildTools -NuGetRestore:$restoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $msBuildLocation -MSBuildArguments $msBuildArguments -Clean:$clean -NoTimelineLogger:(!$logProjectEvents)
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
#>
# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Trace-VstsEnteringInvocation
Register-Mock Trace-VstsLeavingInvocation
Register-Mock Import-VstsLocStrings
foreach ($clean in @($true, $false)) {
    foreach ($restoreNuGetPackages in @($true, $false)) {
        foreach ($logProjectEvents in @($true, $false)) {
            Unregister-Mock Get-VstsInput
            Unregister-Mock Get-SolutionFiles
            Unregister-Mock Format-MSBuildArguments
            Unregister-Mock Select-MSBuildLocation
            Unregister-Mock Invoke-BuildTools
            Register-Mock Get-VstsInput { 'Some input method' } -- -Name MSBuildLocationMethod
            Register-Mock Get-VstsInput { 'Some input location' } -- -Name MSBuildLocation
            Register-Mock Get-VstsInput { 'Some input arguments' } -- -Name MSBuildArguments
            Register-Mock Get-VstsInput { 'Some input solution' } -- -Name Solution -Require
            Register-Mock Get-VstsInput { 'Some input platform' } -- -Name Platform
            Register-Mock Get-VstsInput { 'Some input configuration' } -- -Name Configuration
            Register-Mock Get-VstsInput { $clean } -- -Name Clean -AsBool
            Register-Mock Get-VstsInput { $restoreNuGetPackages } -- -Name RestoreNuGetPackages -AsBool
            Register-Mock Get-VstsInput { $logProjectEvents } -- -Name LogProjectEvents -AsBool
            Register-Mock Get-VstsInput { 'Some input version' } -- -Name MSBuildVersion
            Register-Mock Get-VstsInput { 'Some input architecture' } -- -Name MSBuildArchitecture
            Register-Mock Get-SolutionFiles { 'Some solution 1', 'Some solution 2' } -- -Solution 'Some input solution'
            Register-Mock Format-MSBuildArguments { 'Some formatted arguments' } -- -MSBuildArguments 'Some input arguments' -Platform 'Some input platform' -Configuration 'Some input configuration'
            Register-Mock Select-MSBuildLocation { 'Some location' } -- -Method 'Some input method' -Location 'Some input location' -Version 'Some input version' -Architecture 'Some input architecture'
            Register-Mock Invoke-BuildTools { 'Some build output line 1', 'Some build output line 2' }

            # Act.
            $output = & $PSScriptRoot\..\..\..\Tasks\MSBuild\MSBuild_PS3.ps1

            # Assert.
            Assert-AreEqual ('Some build output line 1', 'Some build output line 2') $output
            Assert-WasCalled Invoke-BuildTools -- -NuGetRestore: $restoreNuGetPackages -SolutionFiles @('Some solution 1', 'Some solution 2') -MSBuildLocation 'Some location' -MSBuildArguments 'Some formatted arguments' -Clean: $clean -NoTimelineLogger: $(!$logProjectEvents)
        }
    }
}
