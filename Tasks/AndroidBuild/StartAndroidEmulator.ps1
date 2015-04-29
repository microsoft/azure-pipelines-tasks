param(
	[string]$emulatorTarget = "android-19",         # Emulator target version
	[string]$emulatorDevice = "Nexus 5",            # Emulator device 
	[string]$emulatorName = "AndroidBuildEmulator", # Name of emulator
	[Boolean]$headlessEmulator = $FALSE,            # Avoid showing the emulator interface if true
	[int]$timeout = 300                             # Length of time allowed per try
)

Write-Verbose "Entering script StartAndroidEmulator.ps1"
Write-Verbose "emulatorTarget = $emulatorTarget"
Write-Verbose "emulatorDevice = $emulatorDevice"
Write-Verbose "emulatorName = $emulatorName"
Write-Verbose "headlessEmulator = $headlessEmulator"
Write-Verbose "timeout = $timeout seconds"

if ($env:ANDROID_HOME -eq $null)
{
    throw 'Environment variable not set: ANDROID_HOME'
}

$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
if (!(Test-Path -Path $adbexe))
{
    throw "File not found: $adbexe"
}

$androidbat = $env:ANDROID_HOME + "\tools\android.bat"
if (!(Test-Path -Path $androidbat))
{
    throw "File not found: $androidbat"
}

# Set up default emulator settings 
$abi = "default/x86"

Stop-Process -processname emulator-x86 2> $null
& $adbexe kill-server 2> $null
& $androidbat delete avd -n $emulatorName 2> $null

# Create an emulator device
# TODO: Figure out how to validate this. Exit code always returns 0. 
& $androidbat create avd --name $emulatorName --target $emulatorTarget --device $emulatorDevice --abi $abi  --force

# Start emulator
# TODO: Figure out how to validate this. Exit code always returns 0. 
$emublock = {
	param($headlessEmulator)
	Push-Location $env:ANDROID_HOME
	if($headlessEmulator) {
		.\tools\emulator.exe -avd "AndroidBuildEmulator" -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save -no-skin -no-audio -no-window
	}
	else {
	    .\tools\emulator.exe -avd "AndroidBuildEmulator" -prop persist.sys.language=en -prop persist.sys.country=US -no-snapshot-load -no-snapshot-save
    }
	Pop-Location
}
Start-Job -Name openEmulator -ScriptBlock $emublock -ArgumentList $headlessEmulator | Out-Null

# Connect to emulator
& $adbexe start-server

# Script block containing WaitADBProperty. Putting function in script block so it can be called by job. 
$adbBlock = {
	function WaitADBProperty {
		param(
			[string]$property,
			[string]$expectedOutput,
			[int]$timeout = 10
		)
		Write-Verbose "Waiting for property $property to be $expectedOutput"
		$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
		$adbOutput = 0
		while($adbOutput[0] -ne $expectedOutput) {
			($adbPropertyJob = Start-Job -ScriptBlock {
					param($adbexe, $property)
					& $adbexe shell getprop $property 2> $null
				} -Argumentlist $adbexe, $property) | Out-Null	
			Wait-Job $adbPropertyJob -Timeout $timeout| Out-Null
			Receive-Job $adbPropertyJob -OutVariable adbOutput | Out-Null
		}
	}
}

# TODO: Implement retries
# Running together as a job allows us to set a time out. 
$bootJob = Start-Job -InitializationScript $adbBlock -ScriptBlock {
	WaitADBProperty "dev.bootcomplete" "1"
	WaitADBProperty "sys.boot_completed" "1"
	WaitADBProperty "init.svc.bootanim" "stopped"
	return $TRUE
}
Wait-Job $bootJob -Timeout $timeout | Out-Null
Receive-Job $bootJob -OutVariable bootCompleted | Out-Null

# Check if emulator booted up successfully
if([boolean]$bootCompleted -ne $TRUE) {
    Write-Error "Error: Emulator failed to start within $timeout seconds."
}

Write-Verbose "Leaving script StartAndroidEmulator.ps1"

