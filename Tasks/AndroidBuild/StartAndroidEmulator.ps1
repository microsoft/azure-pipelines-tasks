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

function WaitADBProperty2 {
	param(
		[string]$property,
		[string]$expectedOutput,
		[int]$timeout = 10
	)
	$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
	$adbOutput = 0
	#while($adbOutput.CompareTo($expectedOutput)) {
	while($adbOutput[0] -ne $expectedOutput) {
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
WaitADBProperty2 "sys.boot_completed" "1"
WaitADBProperty2 "init.svc.bootanim" "stopped"

Write-Output "Leaving script StartAndroidEmulator.ps1"
exit 0


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
		$adbOutput = 0
		Write-Output "1Waiting for property $property to be $expectedOutput"
		#while($adbOutput.CompareTo($expectedOutput)) {
		while($adbOutput[0] -ne "1") {
			Write-Output "2Waiting for property $property to be $expectedOutput"
			($adbPropertyJob = Start-Job -ScriptBlock {
					param($adbexe, $property)
					& $adbexe shell getprop $property 2> $null
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
	} -InitializationScript $func)	
Wait-Job $waitADBPropertiesJob -Timeout $timeout| Out-Null
Receive-Job $waitADBPropertiesJob -OutVariable waitJobOutput | Out-Null
Write-Output "$waitJobOutput"

Write-Output "Leaving script StartAndroidEmulator.ps1"
