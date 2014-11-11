param(
    [string]$gradleProj, 
    [string]$arguments, 
    [string]$startEmulator
)

Write-Output "Entering script GradleBuild.ps1"
Write-Output "gradleProj = $gradleProj"
Write-Output "arguments = $arguments"
Write-Output "startEmulator = $startEmulator"

if (!$distributedTaskContext) #running directly via command line
{
    import-module "C:\Agent\src\Package\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.Common"
    #import-module "C:\Agent\src\Package\Agent\Worker\ModulesMicrosoft.TeamFoundation.DistributedTask.Task.Build"
}

# Import the Task.Common dll that has all the cmdlets we need for Build
#import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$startEmulator2 = Convert-String $startEmulator Boolean
#$startEmulator = [System.Convert]::ToBoolean($startEmulator) 
Write-Output "startEmulator (converted) = $startEmulator"

$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
$androidbat = $env:ANDROID_HOME + "\tools\android.bat"

#TODO: Check for file existence first. If gradle file not there, don't bother starting the emulator. 

if($startEmulator2)
{
	Write-Output "startEmulator (converted 2) = $startEmulator"
    Stop-Process -processname emulator-x86 2> $null
    & $adbexe kill-server 2> $null
    & $androidbat delete avd -n Nexus5 2> $null

    # Create an emulator device
    & $androidbat list targets
    & $androidbat create avd --name "Nexus5" --target "android-19" --device "Nexus 5" --abi "default/x86" --force

    # Start emulator
    $emublock = {
        pushd $env:ANDROID_HOME
        Write-Output "*****INFO: Starting emulator!"
        .\tools\emulator.exe -avd "Nexus5" -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save
        popd

    }
    Start-Job -Name openEmulator -ScriptBlock $emublock | Out-Null

    # Connect to emulator
    & $adbexe start-server
    
    # Make sure emulator is fully booted
    # dev.bootcomplete is "1" when the device is fully booted
    $devBootComplete = 0
    $numLoops = 0  # fail out if it takes too long
    Write-Output "*****INFO: Waiting for emulator to fully boot!"
    while ($devBootComplete[0] -ne "1")
    {
        ($bootComplete = Start-Job -Name jobBootComplete -ScriptBlock {
            param($adbexe)
            & $adbexe shell getprop dev.bootcomplete 2> $null
        } -argumentlist $adbexe) |Out-Null
        Wait-Job $bootComplete | Out-Null
        Receive-Job $bootComplete -OutVariable devBootComplete | Out-Null
        $output = "*****INFO: Waiting for emulator to boot..." + $numLoops
        Write-Output $output
        $numLoops++

        # Try to restart adb server every once in a while to see if that is the problem
        if ($numLoops % 25 -eq 0) {
            Write-Output "*****INFO: Restarting adb server!"
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

# Check for file existence
$gradlebat = Join-Path $gradleProj -Child "gradlew.bat"
if ([System.IO.File]::Exists($gradlebat))
{
    Write-Output "Invoking script $gradlebat with arguments $arguments"
    Invoke-BatchScript $gradlebat –Arguments $arguments
}
else
{
    Write-Error "Unable to find script $filename"
}

# Delete emulator device.  Stop-Process is used because Wait-Job or Stop-Job hangs.
if($startEmulator)
{
    Stop-Process -processname emulator-x86
    & $adbexe kill-server 
    & $androidbat delete avd -n Nexus5
}

Write-Output "Leaving script GradleBuild.ps1"
