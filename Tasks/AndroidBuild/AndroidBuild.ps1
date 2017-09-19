param(
    [string]$gradleWrapper,    # Path to gradle wrapper. Empty if using gradle installation. 
    [string]$gradleProj,       # Optional - Root directory of gradle project. Defaults to root of working directory if empty. 
    [string]$gradleArguments,  # Gradle arguments
    [string]$avdName,          # Android Virtual Device name
    [string]$createAvd,        # Create the named AVD
    [string]$emulatorTarget,   # Emulator target version (keep name for back compat)
    [string]$emulatorDevice,   # Emulator device (keep name for back compat)
    [string]$avdAbi,           # Emulator ABI
    [string]$avdForce,         # Overwrite existing AVD (--force)
    [string]$avdOptionalArgs,  # Optional args passed to "android create avd"
    [string]$startEmulator,    # True if emulator start required. Converted to Boolean
    [string]$emulatorTimeout,  # Timeout value when waiting for emulator to start
    [string]$emulatorHeadless, # Headless display
    [string]$emulatorOptionalArgs, # Optional arguments to "tools/emulator"
    [string]$deleteAvd         # Delete AVD
)

Write-Warning "The Android Build task has been deprecated. Use the Gradle task instead. See https://go.microsoft.com/fwlink/?LinkID=613720."

Write-Verbose "Entering script AndroidBuild.ps1"
Write-Verbose "gradleWrapper = $gradleWrapper"
Write-Verbose "gradleProj = $gradleProj"
Write-Verbose "gradleArguments = $gradleArguments"
Write-Verbose "avdName = $avdName"
Write-Verbose "createAvd = $createAvd"
Write-Verbose "emulatorTarget = $emulatorTarget"
Write-Verbose "emulatorDevice = $emulatorDevice"
Write-Verbose "avdAbi = $avdAbi"
Write-Verbose "avdForce =  $avdForce"
Write-Verbose "avdOptionalArgs = $avdOptionalArgs"
Write-Verbose "startEmulator = $startEmulator"
Write-Verbose "emulatorTimeout = $emulatorTimeout"
Write-Verbose "emulatorHeadless = $emulatorHeadless"
Write-Verbose "emulatorOptionalArgs = $emulatorOptionalArgs"
Write-Verbose "deleteAvd = $deleteAvd"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"


# Set the paths of the Start and Kill Android Emulator scripts, which are in the same directory as AndroidBuild.ps1
$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$StartEmulatorScript = Join-Path -Path $PSScriptRoot -ChildPath "StartAndroidEmulator.ps1" 
$KillEmulatorScript = Join-Path -Path $PSScriptRoot -ChildPath "KillAndroidEmulator.ps1"

# Always invoke the start up script, let the script handle create and start emulator checks
$createAvdArgs = "-avdName `"$avdName`" -createAvd $createAvd -avdTarget `"$emulatorTarget`" -avdDevice `"$emulatorDevice`" -avdAbi `"$avdAbi`" -avdForceOverwrite $avdForce -avdOptionalArgs `"$avdOptionalArgs`""
$emulatorArgs = "-startEmulator $startEmulator -timeout `"$emulatorTimeout`" -headlessEmulator $emulatorHeadless -emulatorOptionalArgs `"$emulatorOptionalArgs`""
$startEmulatorCommand = "& `"$StartEmulatorScript`" $createAvdArgs $emulatorArgs"
Write-Verbose "Calling start emulator script: $startEmulatorCommand"
Invoke-Expression -Command $startEmulatorCommand

# Use Gradle Wrapper
if ([System.IO.File]::Exists($gradleWrapper)) 
{
    Write-Verbose "Invoking gradle wrapper $gradleWrapper with arguments $gradleArguments in working directory $gradleProj"
    Invoke-BatchScript $gradleWrapper -Arguments $gradleArguments -WorkingFolder $gradleProj
}
else 
{
    throw "Unable to find script $gradleWrapper"
}

# Always invoke the post build script, emulator must be stopped if we started it
# otherwise task hangs
$killEmulatorCommand = "& `"$KillEmulatorScript`" `"$avdName`" $startEmulator $deleteAvd"
Write-Verbose "Calling stop emulator script with command: $killEmulatorCommand"
Invoke-Expression -Command $killEmulatorCommand

Write-Verbose "Leaving script AndroidBuild.ps1"
