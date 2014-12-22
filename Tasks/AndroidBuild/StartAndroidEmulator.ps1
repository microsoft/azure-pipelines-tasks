param(
	[string]$emulatorTarget = "android-21", # Emulator target version
	[string]$emulatorDevice = "Nexus 5",    # Emulator device 
	[Boolean]$headlessEmulator = $FALSE     # True to avoid showing the emulator interface
)

function Restart-ADB-Server {
	Write-Output "INFO: Restarting adb server!"
	& $adbexe kill-server
    & $adbexe start-server
}

function Wait-For-ADB-Property {
    param(
        [string]$adbCommand, 
		[string]$expectedOutput,
	    [string]$timeout = 30
    )
    Write-Output "Waiting for $adbCommand to be $expectedOutput"
    $adbOutput = 0
    while($adbOutput -neq $expectedOutput) {
        ($bootComplete = Start-Job
		-ScriptBlock {
		    param($adbexe)
		    & $adbexe shell $adbCommand 2> $null
	    } -Argumentlist $adbexe) | Out-Null	
		Wait-Job $bootComplete -Timeout $timeout| Out-Null
		Receive-Job $bootComplete -OutVariable adbOutput | Out-Null
    }
}

function Verify-Boot-Complete {
    param(
	    [string]$timeout = 30
    )
	#time out 
	$job = Start-Job { 
		Wait-For-ADB-Property "getprop dev.bootcompleted", "1", $timeout
		#Wait-For-ADB-Property "getprop sys_bootcomplete", "1", $timeout
		#Wait-For-ADB-Property "getprop init.svc.bootanim", "stopped", $timeout
	}
	Wait-Job $Job.ID -Timeout $timeout | out-null
    $result = Receive-Job $Job.ID
	return $result
}
	
  
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
		Restart-ADB-Server
	}

	# Bail out if the device never comes up
	if ($numLoops -gt 500) {
		Write-Error "ERROR: Emulator failed to start!"
		break
	}
}
}

Write-Output "Entering script StartAndroidEmulator.ps1"
Write-Output "emulatorTarget = $emulatorTarget"
Write-Output "emulatorDevice = $emulatorDevice"
Write-Output "headlessEmulator = $headlessEmulator"

$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
$androidbat = $env:ANDROID_HOME + "\tools\android.bat"

# Set up default emulator settings 
$emuName = "AndroidBuildEmulator"
$abi = "default/x86"

Stop-Process -processname emulator-x86 2> $null
& $adbexe kill-server 2> $null
& $androidbat delete avd -n $emuName 2> $null

# Create an emulator device
# TODO: Figure out how to validate this. Exit code seems to always return 0. 
& $androidbat create avd --name $emuName --target $emulatorTarget --device $emulatorDevice --abi $abi  --force

# Start emulator
#TODO: Figure out how to validate this. Exit code seems to always return 0. 
$emublock = {
	param($emuName)
	param($headlessEmulator)
	Push-Location $env:ANDROID_HOME
	if($headlessEmulator) {
		.\tools\emulator.exe -avd $emuName -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save -no-skin -no-audio -no-window
	}
	else {
	    .\tools\emulator.exe -avd $emuName -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save
    }
	Pop-Location
}
Start-Job -Name openEmulator -ScriptBlock $emublock -ArgumentList $emuName, $headlessEmulator | Out-Null

# Connect to emulator
& $adbexe start-server

# Make sure emulator is fully booted
# dev.bootcomplete is "1" when the device is fully booted
# TODO: Try bootanim with headless. 
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
		Restart-ADB-Server
	}

	# Bail out if the device never comes up
	if ($numLoops -gt 500) {
		Write-Error "ERROR: Emulator failed to start!"
		break
	}
}

Write-Output "Leaving script StartAndroidEmulator.ps1"

