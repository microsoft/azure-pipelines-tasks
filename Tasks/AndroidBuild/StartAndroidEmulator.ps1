param(
	[string]$emulatorTarget = "android-21", # Emulator target version
	[string]$emulatorDevice = "Nexus 5",    # Emulator device 
	[Boolean]$headlessEmulator = $FALSE,    # True to avoid showing the emulator interface
	[int]$retries = 3,                       # Number of times to retry
	[int] $timeout = 300                    # Length of time allowed per try
)

function Restart-ADB-Server {
	& $adbexe kill-server
    & $adbexe start-server
}

function Get-ADB-Property {
    param(
        [string]$property,
		[int]$timeout = 10
    )
	Write-Output "Checking property $property" | Out-Null
	($adbPropertyJob = Start-Job -ScriptBlock {
		    param($adbexe)
		    & $adbexe shell getprop $property 2> $null
	    } -Argumentlist $adbexe) | Out-Null	
	Wait-Job $adbPropertyJob -Timeout $timeout| Out-Null
	Receive-Job $adbPropertyJob -OutVariable adbOutput | Out-Null
	Write-Output "adb shell getprop $property returned $adb" | Out-Null
	return $adbOutput
}

function Verify-Boot-Complete {
    param(
		[int]$timeout = 10
    )
	Write-Output "Verifying boot complete" | Out-Null
	$bootVerified = $TRUE
	
	$devBootComplete = Get-ADB-Property "dev.bootcompleted" 
	if($devBootComplete -ne "1") {
		$bootVerified = $FALSE
	}
	
	$sysBootComplete = Get-ADB-Property "sys_bootcomplete"
	if($sysBootComplete -ne "1") {
		$bootVerified =  $FALSE
	}
	
	$bootAnim = Get-ADB-Property "init.svc.bootanim"
	if($bootAnim -ne "stopped") {
		$bootVerified =  $FALSE
	}
	Write-Output "Returning Verify-Boot-Complete $bootVerified" | Out-Null
	return $bootVerified
}


function Wait-Boot-Complete {
    param(
	    [int]$timeout = 300
    )

	# Manually keep a timer for timeout. 
	$ElapsedTime = [System.Diagnostics.Stopwatch]::StartNew()
	Write-Output "Timer started at $(get-date) with timeout of $timeout seconds" | Out-Null
	
	$bootComplete = $FALSE
	$numTries = 0
	while(!$bootComplete) {
		# Sleep for 1 second, then check properties
		Start-Sleep -s 1
		
		$bootComplete = Verify-Boot-Complete
		Write-Output "Verify-Boot-Complete returned $bootComplete" | Out-Null
		
		# Restart ADB Server occasionally in case of failure. 
		$numTries++
		if($numTries % 50 -eq 0) {
			Write-Output "Restarting adb server!"
			Restart-ADB-Server
		}
		
		if($ElapsedTime.Elapsed.Seconds -gt $timeout) {
			Write-Output "Wait-Boot-Complete timed out after $($ElapsedTime.Elapsed.Seconds) seconds"
			return $FALSE
		}
	}
	Write-Output "Returning Boot Complete: $bootcomplete" | Out-Null
	return $bootComplete
}


Write-Output "Entering script StartAndroidEmulator.ps1"
Write-Output "emulatorTarget = $emulatorTarget"
Write-Output "emulatorDevice = $emulatorDevice"
Write-Output "headlessEmulator = $headlessEmulator"

#TODO Implement retries

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
Wait-Boot-Complete

Write-Output "Leaving script StartAndroidEmulator.ps1"

