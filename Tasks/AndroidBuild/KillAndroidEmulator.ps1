Write-Verbose "Entering script KillAndroidEmulator.ps1"

$emuName = "AndroidBuildEmulator"

$adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
$androidbat = $env:ANDROID_HOME + "\tools\android.bat"

# Delete emulator device.  Stop-Process is used because Wait-Job or Stop-Job hangs.
Stop-Process -processname emulator-x86
& $adbexe kill-server 
& $androidbat delete avd -n $emuName

Write-Verbose "Leaving script KillAndroidEmulator.ps1"
