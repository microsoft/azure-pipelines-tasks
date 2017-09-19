param(
    [string]$avdName,
    [string]$startEmulator,
    [string]$deleteAvd
)

Write-Verbose "Entering script KillAndroidEmulator.ps1"
Write-Verbose "avdName = $avdName"

$emulatorStarted = Convert-String $startEmulator Boolean
Write-Verbose "stopEmulatorChecked (converted) = $emulatorStarted"
$deleteAvdChecked = Convert-String $deleteAvd Boolean
Write-Verbose "deleteAvdChecked (converted) = $deleteAvdChecked"


if ($emulatorStarted)
{
    $emulatorPid = $env:EMULATOR_PID

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

    if ($emulatorPid)
    {
        $emulators = Get-WmiObject -Class Win32_Process -Filter "ParentProcessID=$emulatorPid"
        if ($emulators)
        {
            # Delete emulator device.  Stop-Process is used because Wait-Job or Stop-Job hangs.
            # Emulator.exe is the parent process which spawns the actual child emulator processes
            Stop-Process $emulators.ProcessId
        }
    }

    if ($deleteAvdChecked)
    {
        & $androidbat delete avd -n $avdName
    }

    # Stop any Android Debug Bridge process, otherwise the task may hang.  
    & $adbexe kill-server 
    Stop-Process -processname 'adb' 2> $null
}

Write-Verbose "Leaving script KillAndroidEmulator.ps1"
