[CmdletBinding()]
param()

BEGIN {
    function Mask-Percents{
    param (
        $Contents
    )

    return $Contents.Replace("%", "%%")
    }
}

PROCESS {
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Import-VstsLocStrings "$PSScriptRoot\task.json"

        # Get inputs.
        $input_failOnStderr = Get-VstsInput -Name 'failOnStderr' -AsBool
        $input_script = Get-VstsInput -Name 'script'
        $input_workingDirectory = Get-VstsInput -Name 'workingDirectory' -Require
        Assert-VstsPath -LiteralPath $input_workingDirectory -PathType 'Container'

        # Generate the script contents.
        Write-Host (Get-VstsLocString -Key 'GeneratingScript')
        $contents = "$input_script".Replace("`r`n", "`n").Replace("`n", "`r`n")

        if ($contents.IndexOf("`n") -lt 0 -and $contents.IndexOf("##vso[", ([System.StringComparison]::OrdinalIgnoreCase)) -lt 0) {
            # Print one-liner scripts.
            Write-Host (Get-VstsLocString -Key 'ScriptContents')shell
            Write-Host $contents
        }
        # Prepend @echo off instead of using the /Q command line switch. When /Q is used, echo can't be turned on.
        $contents = "@echo off`r`n$contents"

        # Write the script to disk.
        Assert-VstsAgent -Minimum '2.115.0'
        $tempDirectory = Get-VstsTaskVariable -Name 'agent.tempDirectory' -Require
        Assert-VstsPath -LiteralPath $tempDirectory -PathType 'Container'
        $filePath = [System.IO.Path]::Combine($tempDirectory, "$([System.Guid]::NewGuid()).cmd")
        $fileEncoding = [System.Console]::OutputEncoding
        if ($fileEncoding.CodePage -eq 65001) {
            # If UTF8, write without BOM
            $fileEncoding = New-Object System.Text.UTF8Encoding $False
        }
        $null = [System.IO.File]::WriteAllText(
            $filePath,
            $contents.ToString(),
            $fileEncoding)

        # Prepare the external command values.
        $cmdPath = $env:ComSpec
        Assert-VstsPath -LiteralPath $cmdPath -PathType Leaf
        # Command line switches:
        # /D     Disable execution of AutoRun commands from registry.
        # /E:ON  Enable command extensions. Note, command extensions are enabled
        #        by default, unless disabled via registry.
        # /V:OFF Disable delayed environment expansion. Note, delayed environment
        #        expansion is disabled by default, unless enabled via registry.
        # /S     Will cause first and last quote after /C to be stripped.
        #
        # Note, use CALL otherwise if a script ends with "goto :eof" the errorlevel
        # will not bubble as the exit code of cmd.exe.
        $arguments = "/D /E:ON /V:OFF /S /C `"CALL `"$filePath`"`""
        $splat = @{
            'FileName' = $cmdPath
            'Arguments' = $arguments
            'WorkingDirectory' = $input_workingDirectory
        }

        # Switch to "Continue".
        $global:ErrorActionPreference = 'Continue'
        $failed = $false

        # Run the script.
        Write-Host '========================== Starting Command Output ==========================='
        if (!$input_failOnStderr) {
            Invoke-VstsTool @splat
        } else {
            $inError = $false
            $errorLines = New-Object System.Text.StringBuilder
            Invoke-VstsTool @splat 2>&1 |
                ForEach-Object {
                    if ($_ -is [System.Management.Automation.ErrorRecord]) {
                        # Buffer the error lines.
                        $failed = $true
                        $inError = $true
                        $null = $errorLines.AppendLine("$($_.Exception.Message)")

                        # Write to verbose to mitigate if the process hangs.
                        Write-Verbose "STDERR: $($_.Exception.Message)"
                    } else {
                        # Flush the error buffer.
                        if ($inError) {
                            $inError = $false
                            $message = $errorLines.ToString().Trim()
                            $null = $errorLines.Clear()
                            if ($message) {
                                Write-VstsTaskError -Message $message -IssueSource $IssueSources.CustomerScript
                            }
                        }

                        Write-Host "$_"
                    }
                }

            # Flush the error buffer one last time.
            if ($inError) {
                $inError = $false
                $message = $errorLines.ToString().Trim()
                $null = $errorLines.Clear()
                if ($message) {
                    Write-VstsTaskError -Message $message -IssueSource $IssueSources.CustomerScript
                }
            }
        }

        # Fail on $LASTEXITCODE
        if (!(Test-Path -LiteralPath 'variable:\LASTEXITCODE')) {
            $failed = $true
            Write-Verbose "Unable to determine exit code"
            Write-VstsTaskError -Message (Get-VstsLocString -Key 'PS_UnableToDetermineExitCode')
        } else {
            if ($LASTEXITCODE -ne 0) {
                $failed = $true
                Write-VstsTaskError -Message (Get-VstsLocString -Key 'PS_ExitCode' -ArgumentList $LASTEXITCODE)
            }
        }

        # Fail if any errors.
        if ($failed) {
            Write-VstsSetResult -Result 'Failed' -Message "Error detected" -DoNotThrow
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}