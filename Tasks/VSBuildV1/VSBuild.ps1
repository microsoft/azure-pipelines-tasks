[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
$vsBuildTelemetry = [PSCustomObject]@{
    VsVersion = ""
    CustomVersion = ""
    Platform = ""
    Configuration = ""
    MSBuildExecutionTimeSeconds = ""
}

# Import the helpers.
. $PSScriptRoot\Get-VSPath.ps1
. $PSScriptRoot\Select-VSVersion.ps1
Import-Module -Name "$PSScriptRoot\node_modules\azure-pipelines-tasks-msbuildhelpers\MSBuildHelpers.psm1"

try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"

    # Get task variables.
    [bool]$debug = Get-VstsTaskVariable -Name System.Debug -AsBool

    # Get the inputs.
    [string]$vsVersion = Get-VstsInput -Name VSVersion
    [string]$msBuildArchitecture = Get-VstsInput -Name MSBuildArchitecture
    [string]$msBuildArgs = Get-VstsInput -Name MSBuildArgs
    [string]$solution = Get-VstsInput -Name Solution -Require
    [string]$platform = Get-VstsInput -Name Platform
    [string]$configuration = Get-VstsInput -Name Configuration
    [bool]$clean = Get-VstsInput -Name Clean -AsBool
    [bool]$maximumCpuCount = Get-VstsInput -Name MaximumCpuCount -AsBool
    [bool]$restoreNugetPackages = Get-VstsInput -Name RestoreNugetPackages -AsBool
    [bool]$logProjectEvents = Get-VstsInput -Name LogProjectEvents -AsBool
    [bool]$createLogFile = Get-VstsInput -Name CreateLogFile -AsBool
    [string]$logFileVerbosity = if ($debug) { "diagnostic" } else { Get-VstsInput -Name LogFileVerbosity }
    [bool]$enableDefaultLogger = Get-VstsInput -Name EnableDefaultLogger -AsBool
    [string]$customVersion = Get-VstsInput -Name customVersion

    # Warn if deprecated inputs were specified.
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

    $vsBuildTelemetry.VsVersion = "$vsVersion"
    $vsBuildTelemetry.CustomVersion = "$customVersion"
    $vsBuildTelemetry.Platform = "$platform"
    $vsBuildTelemetry.Configuration = "$configuration"
    $vsBuildTelemetry.MSBuildExecutionTimeSeconds = ""

    # Resolve match patterns.
    $solutionFiles = Get-SolutionFiles -Solution $Solution

    # Resolve a VS version.
    if ($customVersion) {
        $vsVersion = Select-VSVersion -PreferredVersion $customVersion
    } else {
        $vsVersion = Select-VSVersion -PreferredVersion $vsVersion
    }

    # Translate to MSBuild version.
    $msBuildVersion = $null;
    switch ("$vsVersion") {
        '' { $msBuildVersion = '14.0' ; break } # VS wasn't found. Attempt to find MSBuild 14.0 or lower.
        '17.0' { $msBuildVersion = '17.0' ; break }
        '16.0' { $msBuildVersion = '16.0' ; break }
        '15.0' { $msBuildVersion = '15.0' ; break }
        '14.0' { $msBuildVersion = '14.0' ; break }
        '12.0' { $msBuildVersion = '12.0' ; break }
        '11.0' { $msBuildVersion = '4.0' ; break }
        '10.0' { $msBuildVersion = '4.0' ; break }
        default { throw (Get-VstsLocString -Key UnexpectedVSVersion0 -ArgumentList $vsVersion) }
    }

    # Resolve the corresponding MSBuild location.
    $msBuildLocation = Select-MSBuildPath -PreferredVersion $msBuildVersion -Architecture $msBuildArchitecture

    # Format the MSBuild args.
    $MSBuildArgs = Format-MSBuildArguments -MSBuildArguments $MSBuildArgs -Platform $Platform -Configuration $Configuration -VSVersion $VSVersion -MaximumCpuCount:$maximumCpuCount

    # Change the error action preference to 'Continue' so that each solution will build even if
    # one fails. Since the error action preference is being changed from 'Stop' (the default for
    # PowerShell3 handler) to 'Continue', errors will no longer be terminating and "Write-VstsSetResult"
    # needs to explicitly be called to fail the task. Invoke-BuildTools handles calling
    # "Write-VstsSetResult" on nuget.exe/msbuild.exe failure.
    $global:ErrorActionPreference = 'Continue'

    $stopwatch = New-Object System.Diagnostics.Stopwatch
    $stopwatch.Start()

    # Build each solution.
    Invoke-BuildTools -NuGetRestore:$RestoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $MSBuildLocation -MSBuildArguments $MSBuildArgs -Clean:$Clean -NoTimelineLogger:(!$LogProjectEvents) -CreateLogFile:$createLogFile -LogFileVerbosity:$logFileVerbosity -IsDefaultLoggerEnabled:$enableDefaultLogger

    $stopwatch.Stop()
    $vsBuildTelemetry.MSBuildExecutionTimeSeconds = $stopwatch.ElapsedMilliseconds / 1000
} finally {
    EmitTelemetry -TelemetryPayload $vsBuildTelemetry -TaskName "VSBuildV1"
    Trace-VstsLeavingInvocation $MyInvocation
}