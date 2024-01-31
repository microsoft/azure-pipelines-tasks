[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Trace-VstsEnteringInvocation
Register-Mock Trace-VstsLeavingInvocation
Register-Mock Import-VstsLocStrings
Register-Mock EmitTelemetry
$variableSets = @(
    @{ Clean = $false ; MaximumCpuCount = $false ; RestoreNugetPackages = $false ; LogProjectEvents = $false ; CreateLogFile = $false ; LogFileVerbosity = '' ; Debug = $false }
    @{ Clean = $false ; MaximumCpuCount = $false ; RestoreNugetPackages = $false ; LogProjectEvents = $false ; CreateLogFile = $true ; LogFileVerbosity = '' ; Debug = $false }
    @{ Clean = $false ; MaximumCpuCount = $false ; RestoreNugetPackages = $false ; LogProjectEvents = $true ; CreateLogFile = $false ; LogFileVerbosity = '' ; Debug = $false }
    @{ Clean = $false ; MaximumCpuCount = $false ; RestoreNugetPackages = $true ; LogProjectEvents = $false ; CreateLogFile = $false ; LogFileVerbosity = '' ; Debug = $false }
    @{ Clean = $false ; MaximumCpuCount = $true ; RestoreNugetPackages = $false ; LogProjectEvents = $false ; CreateLogFile = $false ; LogFileVerbosity = '' ; Debug = $false }
    @{ Clean = $true ; MaximumCpuCount = $false ; RestoreNugetPackages = $false ; LogProjectEvents = $false ; CreateLogFile = $false ; LogFileVerbosity = '' ; Debug = $false }
    @{ Clean = $false ; MaximumCpuCount = $false ; RestoreNuGetPackages = $false ; LogProjectEvents = $false ; CreateLogFile = $false ; LogFileVerbosity = '' ; Debug = $true }
    @{ Clean = $false ; MaximumCpuCount = $false ; RestoreNuGetPackages = $false ; LogProjectEvents = $false ; CreateLogFile = $true ; LogFileVerbosity = 'detailed' ; Debug = $false }
    @{ Clean = $false ; MaximumCpuCount = $false ; RestoreNuGetPackages = $false ; LogProjectEvents = $false ; CreateLogFile = $true ; LogFileVerbosity = 'detailed' ; Debug = $true }
)
foreach ($variableSet in $variableSets) {
    Unregister-Mock Get-VstsInput
    Unregister-Mock Get-VstsTaskVariable
    Unregister-Mock Get-SolutionFiles
    Unregister-Mock Format-MSBuildArguments
    Unregister-Mock Select-MSBuildPath
    Unregister-Mock Invoke-BuildTools
    Register-Mock Get-VstsInput { 'Some input method' } -- -Name MSBuildLocationMethod
    Register-Mock Get-VstsInput { 'Some input location' } -- -Name MSBuildLocation
    Register-Mock Get-VstsInput { 'Some input arguments' } -- -Name MSBuildArguments
    Register-Mock Get-VstsInput { 'Some input solution' } -- -Name Solution -Require
    Register-Mock Get-VstsInput { 'Some input platform' } -- -Name Platform
    Register-Mock Get-VstsInput { 'Some input configuration' } -- -Name Configuration
    Register-Mock Get-VstsInput { $variableSet.Clean } -- -Name Clean -AsBool
    Register-Mock Get-VstsInput { $variableSet.MaximumCpuCount } -- -Name MaximumCpuCount -AsBool
    Register-Mock Get-VstsInput { $variableSet.RestoreNuGetPackages } -- -Name RestoreNuGetPackages -AsBool
    Register-Mock Get-VstsInput { $variableSet.LogProjectEvents } -- -Name LogProjectEvents -AsBool
    Register-Mock Get-VstsInput { $variableSet.CreateLogFile } -- -Name CreateLogFile -AsBool
    Register-Mock Get-VstsInput { 'Some input version' } -- -Name MSBuildVersion
    Register-Mock Get-VstsInput { 'Some input architecture' } -- -Name MSBuildArchitecture
    Register-Mock Get-VstsInput { $variableSet.LogFileVerbosity } -- -Name LogFileVerbosity
    Register-Mock Get-VstsTaskVariable { $variableSet.Debug } -- -Name System.Debug -AsBool
    Register-Mock Get-SolutionFiles { 'Some solution 1', 'Some solution 2' } -- -Solution 'Some input solution'
    Register-Mock Format-MSBuildArguments { 'Some formatted arguments' } -- -MSBuildArguments 'Some input arguments' -Platform 'Some input platform' -Configuration 'Some input configuration' -MaximumCpuCount: $variableSet.MaximumCpuCount
    Register-Mock Select-MSBuildPath { 'Some location' } -- -Method 'Some input method' -Location 'Some input location' -PreferredVersion 'Some input version' -Architecture 'Some input architecture'
    Register-Mock Invoke-BuildTools { 'Some build output line 1', 'Some build output line 2' }

    $ExpectedCreateLogFile = $variableSet.CreateLogFile
    $ExpectedLogFileVerbosity = if ($variableSet.Debug) { 'diagnostic' } else { $variableSet.LogFileVerbosity }

    # Act.
    $output = & $PSScriptRoot\..\MSBuild.ps1

    # Assert.
    Assert-AreEqual ('Some build output line 1', 'Some build output line 2') $output
    Assert-WasCalled Invoke-BuildTools -- -NuGetRestore: $variableSet.RestoreNuGetPackages -SolutionFiles @('Some solution 1', 'Some solution 2') -MSBuildLocation 'Some location' -MSBuildArguments 'Some formatted arguments' -Clean: $variableSet.Clean -NoTimelineLogger: $(!$variableSet.LogProjectEvents) -CreateLogFile: $ExpectedCreateLogFile -LogFileVerbosity: $ExpectedLogFileVerbosity
}
