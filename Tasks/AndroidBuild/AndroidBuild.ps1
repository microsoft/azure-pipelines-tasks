param(
    [string]$gradleWrapper,   # Path to gradle wrapper. Empty if using gradle installation. 
    [string]$gradleProj,      # Optional - Root directory of gradle project. Defaults to root of working directory if empty. 
    [string]$gradleArguments, # Gradle arguments
    [string]$startEmulator,   # True if emulator start required. Converted to Boolean
	[string]$emulatorTarget,  # Emulator target version
	[string]$emulatorDevice   # Emulator device 
)

Write-Verbose "Entering script AndroidBuild.ps1"
Write-Verbose "gradleWrapper = $gradleWrapper"
Write-Verbose "gradleProj = $gradleProj"
Write-Verbose "gradleArguments = $gradleArguments"
Write-Verbose "startEmulator = $startEmulator"
Write-Verbose "emulatorTarget = $emulatorTarget"
Write-Verbose "emulatorDevice = $emulatorDevice"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$emulator = Convert-String $startEmulator Boolean
Write-Verbose "startEmulator (converted) = $emulator"

# Set the paths of the Start and Kill Android Emulator scripts, which are in the same directory as AndroidBuild.ps1
$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$StartEmulatorScript = Join-Path -Path $PSScriptRoot -ChildPath "StartAndroidEmulator.ps1" 
$KillEmulatorScript = Join-Path -Path $PSScriptRoot -ChildPath "KillAndroidEmulator.ps1"

$emuName = "AndroidBuildEmulator"

if($emulator) {
    Invoke-Expression "$StartEmulatorScript `"$emulatorTarget`" `"$emulatorDevice`" `"$emuName`""
}

# Change working directory to specified gradle project. 
if($gradleProj) {
    Write-Verbose "Setting working directory to $gradleProj"
    Push-Location $gradleProj
}

if($gradleWrapper){
    # Use Gradle Wrapper
    if ([System.IO.File]::Exists($gradleWrapper)) {
        Write-Verbose "Invoking gradle wrapper $gradleWrapper with arguments $gradleArguments"
        Invoke-BatchScript $gradleWrapper –Arguments $gradleArguments
    }
    else {
        Write-Error "Unable to find script $gradleWrapper"
    }
}
else {
    # Use gradle installation. Path variable must be set to include GRADLE_HOME/bin, per Gradle documentation. 
    Write-Verbose "Invoking gradle with arguments $gradleArguments"
    $gradleCommand = "gradle " + $gradleArguments
    Invoke-Expression $gradleCommand
}

if($gradleProj) {
    Pop-Location
}

# Delete emulator device.  Stop-Process is used because Wait-Job or Stop-Job hangs.
if($emulator)
{
	Invoke-Expression "$KillEmulatorScript $emuName"
}

Write-Verbose "Leaving script AndroidBuild.ps1"
