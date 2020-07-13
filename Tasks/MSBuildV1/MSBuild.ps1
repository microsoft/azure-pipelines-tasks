[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
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
    [bool]$createLogFile = (Get-VstsInput -Name CreateLogFile -AsBool) -or $debug
    [string]$logFileVerbosity = if ($debug) { "diagnostic" } else { Get-VstsInput -Name LogFileVerbosity }
    [string]$msBuildVersion = Get-VstsInput -Name MSBuildVersion
    [string]$msBuildArchitecture = Get-VstsInput -Name MSBuildArchitecture

    # Import the helpers.
    Import-Module -Name $PSScriptRoot\ps_modules\MSBuildHelpers\MSBuildHelpers.psm1

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
    Invoke-BuildTools -NuGetRestore:$restoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $msBuildLocation -MSBuildArguments $msBuildArguments -Clean:$clean -NoTimelineLogger:(!$logProjectEvents) -CreateLogFile:$createLogFile -LogFileVerbosity:$logFileVerbosity
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}