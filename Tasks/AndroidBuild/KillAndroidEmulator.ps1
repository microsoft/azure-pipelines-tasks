param(
	[string]$emulatorName = "AndroidBuildEmulator" # Name of emulator
)

Write-Verbose "Entering script KillAndroidEmulator.ps1"
Write-Verbose "emulatorName = $emulatorName"

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
