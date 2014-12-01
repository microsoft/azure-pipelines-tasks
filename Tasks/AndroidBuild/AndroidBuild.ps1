param(
    [string]$gradleWrapper,  # Path to gradle wrapper. Empty if using gradle installation. 
    [string]$gradleProj,     # Optional - Root directory of gradle project. Defaults to root of working directory if empty. 
    [string]$arguments,      # Gradle arguments
    [string]$startEmulator,  # True if emulator start required. Converted to Boolean
	[string]$emulatorTarget, # Emulator target version
	[string]$emulatorDevice  # Emulator device 
)

Write-Output "Entering script AndroidBuild.ps1"
Write-Output "gradleWrapper = $gradleWrapper"
Write-Output "gradleProj = $gradleProj"
Write-Output "arguments = $arguments"
Write-Output "startEmulator = $startEmulator"
Write-Output "emulatorTarget = $emulatorTarget"
Write-Output "emulatorDevice = $emulatorDevice"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "C:\Agent\src\Package\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.Common"
#import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

#$emulator = Convert-String $startEmulator Boolean
$emulator = [System.Convert]::ToBoolean($startEmulator)
Write-Output "startEmulator (converted) = $startEmulator"

$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
$androidbat = $env:ANDROID_HOME + "\tools\android.bat"


if($emulator)
{
    # Set up default emulator settings 
	$emuName = "AndroidBuildEmulator"
	$abi = "default/x86"

    Stop-Process -processname emulator-x86 2> $null
    & $adbexe kill-server 2> $null
    & $androidbat delete avd -n $emuName 2> $null

    # Create an emulator device
    #& $androidbat list targets
    #& $androidbat create avd --name "AndroidBuildEmulator" --target "$emulatorTarget" --device "Nexus 5" --abi "default/x86" --force
	& $androidbat create avd --name $emuName --target $emulatorTarget --device $emulatorDevice --abi $abi  --force

    # Start emulator
    $emublock = {
		param($emuName)
        Push-Location $env:ANDROID_HOME
        Write-Output "INFO: Starting emulator!"
        .\tools\emulator.exe -avd $emuName -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save
        Pop-Location
    }
    Start-Job -Name openEmulator -ScriptBlock $emublock -ArgumentList $emuName | Out-Null

    # Connect to emulator
    & $adbexe start-server
    
    # Make sure emulator is fully booted
    # dev.bootcomplete is "1" when the device is fully booted
    $devBootComplete = 0
    $numLoops = 0  # fail out if it takes too long
    Write-Output "INFO: Waiting for emulator to fully boot!"
    while ($devBootComplete[0] -ne "1")
    {
        ($bootComplete = Start-Job -Name jobBootComplete -ScriptBlock {
            param($adbexe)
            & $adbexe shell getprop dev.bootcomplete 2> $null
        } -argumentlist $adbexe) | Out-Null
        Wait-Job $bootComplete | Out-Null
        Receive-Job $bootComplete -OutVariable devBootComplete | Out-Null
        $output = "INFO: Waiting for emulator to boot..." + $numLoops
        Write-Output $output
        $numLoops++

        # Try to restart adb server every once in a while to see if that is the problem
        if ($numLoops % 25 -eq 0) {
            Write-Output "INFO: Restarting adb server!"
            & $adbexe kill-server
            & $adbexe start-server
        }

        # Bail out if the device never comes up
        if ($numLoops -gt 500) {
            Write-Error "ERROR: Emulator failed to start!"
            break
        }
    }
}

# Change working directory to specified gradle project. 
if($gradleProj) {
    Write-Output "Setting working directory to $gradleProj"
    Push-Location $gradleProj
}

if($gradleWrapper){
    # Use Gradle Wrapper
    if ([System.IO.File]::Exists($gradleWrapper)) {
        Write-Output "Invoking gradle wrapper $gradleWrapper with arguments $arguments"
        Invoke-BatchScript $gradleWrapper –Arguments $arguments
    }
    else {
        Write-Error "Unable to find script $gradleWrapper"
    }
}
else {
    # Use gradle installation. Path variable must be set to include GRADLE_HOME/bin, per Gradle documentation. 
    Write-Output "Invoking gradle with arguments $arguments"
    $gradleCommand = "gradle " + $arguments
    Invoke-Expression $gradleCommand
}

if($gradleProj) {
    Pop-Location
}



# Delete emulator device.  Stop-Process is used because Wait-Job or Stop-Job hangs.
if($emulator)
{
    Stop-Process -processname emulator-x86
    & $adbexe kill-server 
    & $androidbat delete avd -n $emuName
}

Write-Output "Leaving script AndroidBuild.ps1"
