[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Convert-String { [bool]::Parse($args[0]) }
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }

# Act/Assert.
$splat = @{
    'VSLocation' = ''
    'VSVersion' = 'Some input VS version'
    'MSBuildLocation' = ''
    'MSBuildVersion' = ''
    'MSBuildArchitecture' = 'Some input architecture'
    'MSBuildArgs' = 'Some input arguments' 
    'Solution' = '' 
    'Platform' = 'Some input platform'
    'Configuration' = 'Some input configuration'
    'Clean' = 'True'
    'RestoreNuGetPackages' = 'True'
    'LogProjectEvents' = 'True'
    'OmitDotSource' = 'true'
}
Assert-Throws { & $PSScriptRoot\..\..\..\Tasks\VSBuild\VSBuild.ps1 @splat } -MessagePattern "*solution*"
