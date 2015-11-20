[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Convert-String { [bool]::Parse($args[0]) }
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-SolutionFiles { 'Some solution 1', 'Some solution 2' } -- -Solution 'Some input solution'
Register-Mock Write-Warning
Register-Mock Select-VSVersion
Register-Mock Select-MSBuildLocation
Register-Mock Format-MSBuildArguments
Register-Mock Invoke-BuildTools { 'Some build output' }
# Act.
$splat = @{
    'VSLocation' = ''
    'VSVersion' = 'Some input VS version'
    'MSBuildLocation' = ''
    'MSBuildVersion' = 'Some input MSBuild version'
    'MSBuildArchitecture' = 'Some input architecture'
    'MSBuildArgs' = 'Some input arguments' 
    'Solution' = 'Some input solution' 
    'Platform' = 'Some input platform'
    'Configuration' = 'Some input configuration'
    'Clean' = 'True'
    'RestoreNuGetPackages' = 'True'
    'LogProjectEvents' = 'True'
    'OmitDotSource' = 'true'
}
$output = & $PSScriptRoot\..\..\..\Tasks\VSBuild\VSBuild.ps1 @splat

# Assert.
Assert-AreEqual 'Some build output' $output
Assert-WasCalled Write-Warning -Times 1 # Exactly once.
