param(
    [string]$createAvd,         # Create AVD
    [string]$avdName,           # Name of AVD 
    [string]$avdTarget,         # AVD target version
    [string]$avdDevice,         # AVD device 
    [string]$avdAbi,            # AVD ABI
    [string]$avdForceOverwrite, # Force overwrite existing AVD 
    [string]$avdOptionalArgs,   # AVD Optional args
    [string]$startEmulator,     # True if emulator start required. Converted to Boolean
    [string]$headlessEmulator,  # Avoid showing the emulator interface if true
    [int]$timeout               # Length of time allowed per try
)

Write-Verbose "Entering script StartAndroidEmulator.ps1"
Write-Verbose "createAvd = $createAvd"
Write-Verbose "avdTarget = $avdTarget"
Write-Verbose "avdDevice = $avdDevice"
Write-Verbose "avdName = $avdName"
Write-Verbose "avdAbi = $avdAbi"
Write-Verbose "avdForceOverwrite = $avdForceOverwrite"
Write-Verbose "avdOptionalArgs = $avdOptionalArgs"
Write-Verbose "headlessEmulator = $headlessEmulator"
Write-Verbose "timeout = $timeout seconds"

$startEmulatorChecked = Convert-String $startEmulator Boolean
Write-Verbose "startEmulatorChecked (converted) = $startEmulatorChecked"
$emulatorHeadlessChecked = Convert-String $headlessEmulator Boolean
Write-Verbose "emulatorHeadlessChecked (converted) = $emulatorHeadlessChecked"
$createAvdChecked = Convert-String $createAvd Boolean
Write-Verbose "createAvdChecked (converted) = $createAvdChecked"
$avdForceOverwriteChecked = Convert-String $avdForceOverwrite Boolean
Write-Verbose "avdForceOverwriteChecked (converted) = $avdForceOverwriteChecked"

function Start-EmulatorProcess 
{
    param([string]$arguments)

    Push-Location $env:ANDROID_HOME

    $processStartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processStartInfo.FileName = $env:ANDROID_HOME + "\tools\emulator.exe"
    $processStartInfo.Arguments = $arguments
    $processStartInfo.UseShellExecute = $false
    $processStartInfo.CreateNoWindow = $true
    $processStartInfo.RedirectStandardOutput = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processStartInfo

    # Start the process
    $process.Start() 

    Pop-Location

    return $process 
}

function Clean-EmulatorProcess
{
    param([int]$emulatorPid)

    if ($emulatorPid)
    {
        $emulators = Get-WmiObject -Class Win32_Process -Filter "ParentProcessID=$emulatorPid"
        if ($emulators)
        {
            Stop-Process $emulators.ProcessId
        }
    }

    # Stop any Android Debug Bridge process we started, otherwise the task may hang.  
    # adb process sometimes restarts itself so we may need to kill adb again after kill the emulator 
    & $adbexe kill-server 
    Stop-Process -processname 'adb' 2> $null
}

if ($createAvdChecked) 
{
    if ($env:ANDROID_HOME -eq $null)
    {
        throw 'Environment variable not set: ANDROID_HOME'
    }

    $androidbat = $env:ANDROID_HOME + "\tools\android.bat"
    if (!(Test-Path -Path $androidbat))
    {
        throw "File not found: $androidbat"
    }

    # Create an emulator device
    # Exit code always returns 0. Assume success and if this failed, we will report failure later on
    $createAvdCmd = "& $androidbat create avd --name `"$avdName`" --target $avdTarget --device `"$avdDevice`" --abi $avdAbi $avdOptionalArgs"

    if ($avdForceOverwriteChecked) 
    {
        $createAvdCmd = "$createAvdCmd --force"
    }

    Write-Verbose "Creating AVD with: $createAvdCmd"
    Invoke-Expression -Command $createAvdCmd
}

if ($startEmulatorChecked) 
{
    if ($env:ANDROID_HOME -eq $null)
    {
        throw 'Environment variable not set: ANDROID_HOME'
    }

    $adbexe = $env:ANDROID_HOME + "\platform-tools\adb.exe"
    if (!(Test-Path -Path $adbexe))
    {
        throw "File not found: $adbexe"
    }

    # Start emulator
    # Exit code always returns 0. Assume success and if this failed, we will report failure later on
    Push-Location $env:ANDROID_HOME
    $emulatorArgs = "-avd `"$avdName`" -prop persist.sys.language=en -prop persist.sys.country=US $emulatorOptionalArgs"
    if ($emulatorHeadlessChecked) 
    {
        $emulatorArgs = "$emulatorArgs -no-skin -no-audio -no-window"
    }

    Write-Verbose "Starting emulator with: $emulatorArgs"
    $emulatorProcess = Start-EmulatorProcess -arguments $emulatorArgs 

    # Record the parent process id so we will only kill what we started
    $env:EMULATOR_PID=$emulatorProcess.Id

    Pop-Location

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

    # Running together as a job allows us to set a time out. 
    $bootJob = Start-Job -InitializationScript $adbBlock -ScriptBlock {
    	WaitADBProperty "dev.bootcomplete" "1"
    	WaitADBProperty "sys.boot_completed" "1"
    	WaitADBProperty "init.svc.bootanim" "stopped"
    	return $TRUE
    }

    Write-Host "Wait for $timeout seconds for emulator to start..."
    Wait-Job $bootJob -Timeout $timeout | Out-Null
    Receive-Job $bootJob -OutVariable bootCompleted | Out-Null

    # List attached emulator devices
    & $adbexe devices -l

    # Check if emulator booted up successfully
    if ([boolean]$bootCompleted -ne $TRUE) 
    {
        # Must clean up otherwise the task hangs here
        # Kill whatever process we started
        Clean-EmulatorProcess $emulatorProcess.Id

        Write-Verbose "Emulator property dev.bootcomplete, sys.boot_completed and init.svc.bootanim do not indicate emulator was started up completely."
        throw "Error: Emulator failed to start within $timeout seconds."
    }

    # Stop any Android Debug Bridge process we started, otherwise the task may hang.  
    & $adbexe kill-server 
    Stop-Process -processname 'adb' 2> $null
}

Write-Verbose "Leaving script StartAndroidEmulator.ps1"
