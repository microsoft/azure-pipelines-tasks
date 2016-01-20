[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Remove-Item -LiteralPath "$PSScriptRoot\Strings\resources.resjson\en-US\resources.resjson" -ErrorAction Ignore # This is a temporary targeted fix due to ConvertFrom-Json not appreciating leading comments in the en-US resjson file. None of the other language resjson files have leading comments.
    Import-VstsLocStrings "$PSScriptRoot\Task.json"
    [string]$vsVersion = Get-VstsInput -Name VSVersion
    [string]$msBuildArchitecture = Get-VstsInput -Name MSBuildArchitecture
    [string]$msBuildArgs = Get-VstsInput -Name MSBuildArgs
    [string]$solution = Get-VstsInput -Name Solution -Require
    [string]$platform = Get-VstsInput -Name Platform
    [string]$configuration = Get-VstsInput -Name Configuration
    [bool]$clean = Get-VstsInput -Name Clean -AsBool
    [bool]$restoreNugetPackages = Get-VstsInput -Name RestoreNugetPackages -AsBool
    [bool]$logProjectEvents = Get-VstsInput -Name LogProjectEvents -AsBool
    if ([string]$vsLocation = Get-VstsInput -Name VSLocation) {
        Write-Warning (Get-VstsLocString -Key VSLocationDeprecated0 -ArgumentList $vsLocation)
        $vsLocation = $null
    }

    if ([string]$msBuildLocation = Get-VstsInput -Name MSBuildLocation) {
        Write-Warning (Get-VstsLocString -Key MSBuildLocationDeprecated0 -ArgumentList $msBuildLocation)
        $msBuildLocation = $null
    }

    if ([string]$msBuildVersion = Get-VstsInput -Name MSBuildVersion) {
        Write-Warning (Get-VstsLocString -Key MSBuildVersionDeprecated0 -ArgumentList $msBuildVersion)
        $msBuildVersion = $null
    }

    . $PSScriptRoot\Get-VSPath.ps1
    . $PSScriptRoot\Select-MSBuildLocation.ps1
    . $PSScriptRoot\Select-VSVersion.ps1
    Import-Module -Name $PSScriptRoot\ps_modules\MSBuildHelpers\MSBuildHelpers.psm1
    $solutionFiles = Get-SolutionFiles -Solution $Solution
    $VSVersion = Select-VSVersion -PreferredVersion $VSVersion
    $MSBuildLocation = Select-MSBuildLocation -VSVersion $VSVersion -Architecture $MSBuildArchitecture
    $MSBuildArgs = Format-MSBuildArguments -MSBuildArguments $MSBuildArgs -Platform $Platform -Configuration $Configuration -VSVersion $VSVersion
    $ErrorActionPreference = 'Continue'
    Invoke-BuildTools -NuGetRestore:$RestoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $MSBuildLocation -MSBuildArguments $MSBuildArgs -Clean:$Clean -NoTimelineLogger:(!$LogProjectEvents)
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}