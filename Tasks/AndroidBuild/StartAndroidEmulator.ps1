param(
    [string]$startEmulator,   # True if emulator start required. Converted to Boolean
	[string]$emulatorTarget,  # Emulator target version
	[string]$emulatorDevice   # Emulator device 
)

Write-Verbose "Entering script StartAndroidEmulator.ps1"
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
	& $androidbat create avd --name $emuName --target $emulatorTarget --device $emulatorDevice --abi $abi  --force

    # Start emulator
    $emublock = {
		param($emuName)
        Push-Location $env:ANDROID_HOME
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
    Write-Verbose "INFO: Waiting for emulator to fully boot!"
    while ($devBootComplete[0] -ne "1")
    {
        ($bootComplete = Start-Job -Name jobBootComplete -ScriptBlock {
            param($adbexe)
            & $adbexe shell getprop dev.bootcomplete 2> $null
        } -argumentlist $adbexe) | Out-Null
        Wait-Job $bootComplete | Out-Null
        Receive-Job $bootComplete -OutVariable devBootComplete | Out-Null
        $output = "INFO: Waiting for emulator to boot..." + $numLoops
        Write-Verbose $output
        $numLoops++

        # Try to restart adb server every once in a while to see if that is the problem
        if ($numLoops % 25 -eq 0) {
            Write-Verbose "INFO: Restarting adb server!"
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
    Stop-Process -processname emulator-x86
    & $adbexe kill-server 
    & $androidbat delete avd -n $emuName
}

Write-Verbose "Leaving script AndroidBuild.ps1"
