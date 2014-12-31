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
	Write-Output "adb shell getprop $property returned $adbOutput" | Out-Null
	return $adbOutput
}

function WaitADBProperty2 {
	param(
		[string]$property,
		[string]$expectedOutput,
		[int]$timeout = 10
	)
	$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
	$adbOutput = 0
	#while($adbOutput.CompareTo($expectedOutput)) {
	while($adbOutput[0] -ne "1") {
		#Write-Output "Waiting for property $property to be $expectedOutput"
		($adbPropertyJob = Start-Job -ScriptBlock {
				param($adbexe, $property)
				& $adbexe shell getprop $property 2> $null
				#& $adbexe shell getprop dev.bootcomplete 2> $null
			} -Argumentlist $adbexe, $property) | Out-Null	
		Wait-Job $adbPropertyJob -Timeout $timeout| Out-Null
		Receive-Job $adbPropertyJob -OutVariable adbOutput | Out-Null
		Write-Output "adb shell getprop $property returned $adbOutput" 
	}
}

function WaitADBProperty3 {
	param(
		[string]$property,
		[string]$expectedOutput,
		[int]$timeout = 10
	)
	$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
	[string]$adbOutput = ""
	while($adbOutput.CompareTo($expectedOutput)) {
		Write-Output "Waiting for property $property to be $expectedOutput"
		($adbPropertyJob = Start-Job -ScriptBlock {
				param($adbexe)
				#& $adbexe shell getprop $property 2> $null
				& $adbexe shell getprop dev.bootcomplete 2> $null
			} -Argumentlist $adbexe) | Out-Null	
		Wait-Job $adbPropertyJob -Timeout $timeout| Out-Null
		#Wait-Job $adbPropertyJob | Out-Null
		Receive-Job $adbPropertyJob -OutVariable adbOutput | Out-Null
		Write-Output "adb shell getprop $property returned $adbOutput" 
	}
}

function Verify-Boot-Complete {
    param(
		[int]$timeout = 10
    )
	Write-Output "Verifying boot complete" | Out-Null
	$bootVerified = $TRUE
	
	$devBootComplete = Get-ADB-Property "dev.bootcomplete" 
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
$abi = "default/x86"
$emuName = "AndroidBuildEmulator"

Stop-Process -processname emulator-x86 2> $null
& $adbexe kill-server 2> $null
& $androidbat delete avd -n $emuName 2> $null

# Create an emulator device
# TODO: Figure out how to validate this. Exit code seems to always return 0. 
& $androidbat create avd --name $emuName --target $emulatorTarget --device $emulatorDevice --abi $abi  --force

# Start emulator
#TODO: Figure out how to validate this. Exit code seems to always return 0. 
$emublock = {
	param($headlessEmulator)
	Push-Location $env:ANDROID_HOME
	if($headlessEmulator) {
		Write-Output "Headless"
		.\tools\emulator.exe -avd "AndroidBuildEmulator" -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save -no-skin -no-audio -no-window
	}
	else {
		Write-Output "Headed"
	    .\tools\emulator.exe -avd "AndroidBuildEmulator" -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save
    }
	Pop-Location
}
Start-Job -Name openEmulator -ScriptBlock $emublock -ArgumentList $headlessEmulator | Out-Null

# Connect to emulator
& $adbexe start-server
	
WaitADBProperty2 "dev.bootcomplete" "1"


# Make sure emulator is fully booted
Write-Output "Defining func"
$func = {
	function WaitADBProperty {
		param(
			[string]$property,
			[string]$expectedOutput,
			[int]$timeout = 10
		)
		$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
		$adbOutput = $null
		while($adbOutput -ne $expectedOutput) {
			Write-Output "Checking property $property"
			($adbPropertyJob = Start-Job -ScriptBlock {
					param($adbexe, $property)
					#& $adbexe shell getprop $property 2> $null
					& $adbexe shell getprop dev.bootcomplete 2> $null
				} -Argumentlist $adbexe, $property) | Out-Null	
			Wait-Job $adbPropertyJob -Timeout $timeout| Out-Null
			Receive-Job $adbPropertyJob -OutVariable adbOutput | Out-Null
			Write-Output "adb shell getprop $property returned $adbOutput" 
		}
	}
}

Write-Output "creating and waiting on job"
#Wait-Boot-Complete
($waitADBPropertiesJob = Start-Job -ScriptBlock {
	Write-Output "HERE"
	WaitADBProperty  "dev.bootcomplete" "1"
	WaitADBProperty "sys_bootcomplete" "1"
	WaitADBProperty "init.svc.bootanim" "stopped"
	} -InitializationScript $func) | Out-Null	
Wait-Job $waitADBPropertiesJob -Timeout $timeout| Out-Null
Receive-Job $waitADBPropertiesJob -OutVariable waitJobOutput | Out-Null

Write-Output "Leaving script StartAndroidEmulator.ps1"
