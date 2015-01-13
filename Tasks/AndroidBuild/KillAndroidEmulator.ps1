param(
	[string]$emulatorName = "AndroidBuildEmulator" # Name of emulator
)

Write-Verbose "Entering script KillAndroidEmulator.ps1"
Write-Verbose "emulatorName = $emulatorName"

$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
$androidbat = $env:ANDROID_HOME + "\tools\android.bat"

# Delete emulator device.  Stop-Process is used because Wait-Job or Stop-Job hangs.
Stop-Process -processname emulator-x86
& $adbexe kill-server 
& $androidbat delete avd -n $emulatorName

# Remove temporary emulator file
$user = [Environment]::UserName
$tempDirectory = "C:\Users\" + $user + "\AppData\Local\Temp\AndroidEmulator"
if(Test-Path $tempDirectory) {
	Remove-Item $tempDirectory -recurse
}

Write-Verbose "Leaving script KillAndroidEmulator.ps1"
