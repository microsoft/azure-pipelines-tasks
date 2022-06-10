[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
$msbuildTelemetry = [PSCustomObject]@{
    MSBuildVersion = ""
    MSBuildLocationMethod = ""
    Platform = ""
    Configuration = ""
    MSBuildExecutionTimeSeconds = ""
}

# Import the helpers.
Import-Module -Name "$PSScriptRoot\node_modules\azure-pipelines-tasks-msbuildhelpers-v3\MSBuildHelpers.psm1"

try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"

    # Get task variables.
    [bool]$debug = Get-VstsTaskVariable -Name System.Debug -AsBool

    # Get the inputs.
    [string]$msBuildLocationMethod = Get-VstsInput -Name MSBuildLocationMethod
    [string]$msBuildLocation = Get-VstsInput -Name MSBuildLocation
    [string]$msBuildArguments = Get-VstsInput -Name MSBuildArguments
    [string]$solution = Get-VstsInput -Name Solution -Require
    [string]$platform = Get-VstsInput -Name Platform
    [string]$configuration = Get-VstsInput -Name Configuration
    [bool]$clean = Get-VstsInput -Name Clean -AsBool
    [bool]$maximumCpuCount = Get-VstsInput -Name MaximumCpuCount -AsBool
    [bool]$restoreNuGetPackages = Get-VstsInput -Name RestoreNuGetPackages -AsBool
    [bool]$logProjectEvents = Get-VstsInput -Name LogProjectEvents -AsBool
    [bool]$createLogFile = (Get-VstsInput -Name CreateLogFile -AsBool)
    [string]$logFileVerbosity = if ($debug) { "diagnostic" } else { Get-VstsInput -Name LogFileVerbosity }
    [string]$msBuildVersion = Get-VstsInput -Name MSBuildVersion
    [string]$msBuildArchitecture = Get-VstsInput -Name MSBuildArchitecture

    $msbuildTelemetry.MSBuildVersion = "$msBuildVersion"
    $msbuildTelemetry.MSBuildLocationMethod = "$msBuildLocationMethod"
    $msbuildTelemetry.Platform = "$platform"
    $msbuildTelemetry.Configuration = "$configuration"

    # Resolve match patterns.
    $solutionFiles = Get-SolutionFiles -Solution $solution

    # Format the MSBuild args.
    $msBuildArguments = Format-MSBuildArguments -MSBuildArguments $msBuildArguments -Platform $platform -Configuration $configuration -MaximumCpuCount:$maximumCpuCount

    # Resolve the MSBuild location.
    $msBuildLocation = Select-MSBuildPath -Method $msBuildLocationMethod -Location $msBuildLocation -PreferredVersion $msBuildVersion -Architecture $msBuildArchitecture

    # Change the error action preference to 'Continue' so that each solution will build even if
    # one fails. Since the error action preference is being changed from 'Stop' (the default for
    # PowerShell3 handler) to 'Continue', errors will no longer be terminating and "Write-VstsSetResult"
    # needs to explicitly be called to fail the task. Invoke-BuildTools handles calling
    # "Write-VstsSetResult" on nuget.exe/msbuild.exe failure.
    $global:ErrorActionPreference = 'Continue'

    # Build each solution.
    $stopwatch = New-Object System.Diagnostics.Stopwatch
    $stopwatch.Start()

    Invoke-BuildTools -NuGetRestore:$restoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $msBuildLocation -MSBuildArguments $msBuildArguments -Clean:$clean -NoTimelineLogger:(!$logProjectEvents) -CreateLogFile:$createLogFile -LogFileVerbosity:$logFileVerbosity

    $stopwatch.Stop()
    $msbuildTelemetry.MSBuildExecutionTimeSeconds = $stopwatch.ElapsedMilliseconds / 1000
} finally {
    EmitTelemetry -TelemetryPayload $msbuildTelemetry -TaskName "MSBuildV1"
    Trace-VstsLeavingInvocation $MyInvocation
}
