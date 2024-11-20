[CmdletBinding()]
param()

Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_
Import-Module $PSScriptRoot\ps_modules\Sanitizer
Import-Module Microsoft.PowerShell.Security -Global

. $PSScriptRoot\helpers.ps1

$env:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require

function Get-ActionPreference {
    param (
        [Parameter(Mandatory)]
        [string] 
        $VstsInputName,

        [Parameter()]
        [string]
        $DefaultAction = 'Default',

        [Parameter()]
        [string[]]
        $ValidActions = @( 'Default', 'Stop', 'Continue', 'SilentlyContinue' )
    )

    $result = Get-VstsInput -Name $VstsInputName -Default $DefaultAction

    if (-not $ValidActions -contains $result) {
        Write-Error (Get-VstsLocString -Key 'PS_InvalidActionPreference' -ArgumentList @( $VstsInputName, $result, ($ValidActions -join ', ') ))
    }

    return $result
}

class FileBasedToken {
    [void] run($filePath) {
        $signalFromUserScript = "Global\SignalFromUserScript"
        $signalFromTask = "Global\SignalFromTask"
        $exitSignal = "Global\ExitSignal"

        $eventFromB = $null
        $eventFromA = $null
        $eventExit = $null

        try {
            $eventFromB = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $signalFromUserScript)
            $eventFromA = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $signalFromTask)
            $eventExit = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $exitSignal)

            # Ensure the output file has restricted permissions
            if (-not (Test-Path $filePath)) {
                New-Item -Path $filePath -ItemType File -Force
                $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

                # Create a new ACL that only grants access to the current user
                $acl = Get-Acl $filePath
                $acl.SetAccessRuleProtection($true, $false)  # Disable inheritance
                $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $currentUser, "FullControl", "Allow"
                )
                $acl.SetAccessRule($rule)

                # Apply the ACL to the file
                Set-Acl -Path $filePath -AclObject $acl
            }

            Write-Debug "Task: Waiting for signals..."

            # Infinite loop to wait for signals and respond
            while ($true) {
                try {
                    # Wait for either UserScript signal or Exit signal
                    $index = [System.Threading.WaitHandle]::WaitAny(@($eventFromB, $eventExit))

                    if ($index -eq 0) {
                        # Signal from UserScript
                        try {

                            [string]$connectedServiceName = (Get-VstsInput -Name ConnectedServiceName)
        
                            $env:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require
                            
                            $token = ""
        
                            if ($null -eq $connectedServiceName -or $connectedServiceName -eq [string]::Empty) {
                                Write-Host "No Service connection was found, returning the System Access Token"
                                $token = $env:SystemAccessTokenPowershellV2
                            } 
                            else 
                            {
                                $vstsEndpoint = Get-VstsEndpoint -Name $connectedServiceName -Require
        
                                $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint `
                                    -connectedServiceNameARM $connectedServiceName `
                                    -scope "499b84ac-1321-427f-aa17-267ca6975798"
        
                                $token = $result.AccessToken
        
                                if ($null -eq $token -or $token -eq [string]::Empty) {
                                    Write-Debug "Generated token found to be null, returning the System Access Token"
                                    $token = $env:SystemAccessTokenPowershellV2
                                } else {
                                    Write-Debug "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
                                }
                            }
                            $token | Set-Content -Path $filePath
                            Write-Debug "Task: Wrote output to file at $token"                   
                        }
                        catch {
                            Write-Debug "Failed to generate token with message $_, returning the System Access Token"
                            $token = $env:SystemAccessTokenPowershellV2
                            $token | Set-Content -Path $filePath
                            Write-Debug "Task: Wrote output to file at $token" 
                        }

                        # Signal UserScript to read the file
                        $eventFromA.Set()
                    } elseif ($index -eq 1) {
                        # Exit signal received
                        Write-Host "Task: Exit signal received. Exiting loop..."
                        break
                    }
                } catch {
                    Write-Host "Error occurred while waiting for signals: $_"
                }
            }
        } catch {
            Write-Host "Critical error in Task: $_"
        } finally {
            # Cleanup resources
            if ($null -ne $eventFromB ) { $eventFromB.Dispose() }
            if ($null -ne $eventFromA) { $eventFromA.Dispose() }
            if ($null -ne $eventExit) { $eventExit.Dispose() }
            Write-Host "Task: Resources cleaned up. Exiting."
        }
    }
}


Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\task.json"

    $tempDirectory = Get-VstsTaskVariable -Name 'agent.tempDirectory' -Require
    Assert-VstsPath -LiteralPath $tempDirectory -PathType 'Container'
    $tokenfilePath = [System.IO.Path]::Combine($tempDirectory, "$([System.Guid]::NewGuid()).txt")

    # Create a runspace to handle the Get-DerivedValue function
    $runspacePool = [runspacefactory]::CreateRunspacePool(1, 1)
    $runspacePool.Open()
    
    $myObject = [FileBasedToken]::new()
    # Create a PowerShell instance within the runspace pool
    $psRunspace = [powershell]::Create().AddScript({
        param($obj, $filePath)
        try {
            return $obj.run($filePath)
        } catch {
            return $_
        }    
    }).AddArgument($myObject).AddArgument($tokenfilePath)

    $psRunspace.RunspacePool = $runspacePool
    $psRunspace.BeginInvoke()

    Start-Sleep 5

    # Get inputs.
    $input_errorActionPreference = Get-ActionPreference -VstsInputName 'errorActionPreference' -DefaultAction 'Stop'
    $input_warningPreference = Get-ActionPreference -VstsInputName 'warningPreference' -DefaultAction 'Default'
    $input_informationPreference = Get-ActionPreference -VstsInputName 'informationPreference' -DefaultAction 'Default'
    $input_verbosePreference = Get-ActionPreference -VstsInputName 'verbosePreference' -DefaultAction 'Default'
    $input_debugPreference = Get-ActionPreference -VstsInputName 'debugPreference' -DefaultAction 'Default'
    $input_progressPreference = Get-ActionPreference -VstsInputName 'progressPreference' -DefaultAction 'SilentlyContinue'

    $input_showWarnings = Get-VstsInput -Name 'showWarnings' -AsBool
    $input_failOnStderr = Get-VstsInput -Name 'failOnStderr' -AsBool
    $input_ignoreLASTEXITCODE = Get-VstsInput -Name 'ignoreLASTEXITCODE' -AsBool
    $input_pwsh = Get-VstsInput -Name 'pwsh' -AsBool
    $input_workingDirectory = Get-VstsInput -Name 'workingDirectory' -Require
    Assert-VstsPath -LiteralPath $input_workingDirectory -PathType 'Container'
    $input_targetType = Get-VstsInput -Name 'targetType'
    if ("$input_targetType".ToUpperInvariant() -eq "FILEPATH") {
        $input_filePath = Get-VstsInput -Name 'filePath' -Require
        try {
            Assert-VstsPath -LiteralPath $input_filePath -PathType Leaf
        }
        catch {
            Write-Error (Get-VstsLocString -Key 'PS_InvalidFilePath' -ArgumentList $input_filePath)
        }

        if (!$input_filePath.ToUpperInvariant().EndsWith('.PS1')) {
            Write-Error (Get-VstsLocString -Key 'PS_InvalidFilePath' -ArgumentList $input_filePath)
        }

        $input_arguments = Get-VstsInput -Name 'arguments'
    }
    elseif ("$input_targetType".ToUpperInvariant() -eq "INLINE") {
        $input_script = Get-VstsInput -Name 'script'
    }
    else {
        Write-Error (Get-VstsLocString -Key 'PS_InvalidTargetType' -ArgumentList $input_targetType)
    }
    $input_runScriptInSeparateScope = Get-VstsInput -Name 'runScriptInSeparateScope' -AsBool

    # Generate the script contents.
    Write-Host (Get-VstsLocString -Key 'GeneratingScript')
    $contents = @()
    if ($input_errorActionPreference -ne 'Default') {
        $contents += "`$ErrorActionPreference = '$input_errorActionPreference'"
    }
    if ($input_warningPreference -ne 'Default') {
        $contents += "`$WarningPreference = '$input_warningPreference'"
    }
    if ($input_informationPreference -ne 'Default') {
        $contents += "`$InformationPreference = '$input_informationPreference'"
    }
    if ($input_verbosePreference -ne 'Default') {
        $contents += "`$VerbosePreference = '$input_verbosePreference'"
    }
    if ($input_debugPreference -ne 'Default') {
        $contents += "`$DebugPreference = '$input_debugPreference'"
    }
    if ($input_progressPreference -ne 'Default') {
        $contents += "`$ProgressPreference = '$input_progressPreference'"
    }
    # Change default error view to normal view. We need this for error handling since we pipe stdout and stderr to the same stream
    # and we rely on PowerShell piping back NormalView error records (required because PowerShell Core changed the default to ConciseView)
    $contents += "`$ErrorView = 'NormalView'"
    if ("$input_targetType".ToUpperInvariant() -eq 'FILEPATH') {

        try {
            $null = Protect-ScriptArguments -InputArgs $input_arguments -TaskName "PowerShellV2"
        }
        catch {
            $message = $_.Exception.Message

            if ($message -eq (Get-VstsLocString -Key 'ScriptArgsSanitized')) {
                throw $message;
            }

            $telemetry = @{
                'UnexpectedError' = $message
                'ErrorStackTrace' = $_.Exception.StackTrace
            }
            Publish-Telemetry $telemetry
        }

        $contents += ". '$("$input_filePath".Replace("'", "''"))' $input_arguments".Trim()
        Write-Host (Get-VstsLocString -Key 'PS_FormattedCommand' -ArgumentList ($contents[-1]))
    }
    else {
        $contents += "$input_script".Replace("`r`n", "`n").Replace("`n", "`r`n")
    }

    if (!$input_ignoreLASTEXITCODE) {
        $contents += 'if (!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {'
        $contents += '    Write-Host ''##vso[task.debug]$LASTEXITCODE is not set.'''
        $contents += '} else {'
        $contents += '    Write-Host (''##vso[task.debug]$LASTEXITCODE: {0}'' -f $LASTEXITCODE)'
        $contents += '    exit $LASTEXITCODE'
        $contents += '}'
    }

    $joinedContents = [System.String]::Join(
        ([System.Environment]::NewLine),
        $contents);

    
    $joinedContents = '
    
        # Define file path and event names
        $outputFile = "' + $tokenfilePath + '"
        $signalFromB = "Global\SignalFromUserScript"
        $signalFromA = "Global\SignalFromTask"
  
        $eventFromB = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $signalFromB)
        $eventFromA = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $signalFromA)

        function Get-AzDoTokenHelper {
            Write-Debug "User Script: Starting process to notify Task and read output."

            [string]$tokenResponse = $env:SystemAccessTokenPowershellV2

            try {
                # Signal Task to generate access token
                $eventFromB.Set()
                Write-Debug "User Script: Notified Task to generate access token."

                # Wait for Task to finish processing
                $receivedResponseBool = $eventFromA.WaitOne(60000) # Wait for up to 60 seconds
                
                if (!$receivedResponseBool) {  
                    Write-Debug "User Script: Timeout waiting for Task to respond."
                }
                else {
                    try {
                        [string]$powershellv2AccessToken = (Get-Content -Path $outputFile).Trim()
                        Write-Debug "UserScript : Read output from file"
                        $tokenResponse = $powershellv2AccessToken
                    } catch {
                        Write-Debug "Error reading the output file: $_"
                    }
                }
            } 
            catch {
                Write-Host "Error occurred in Get-AzDoTokenHelper : $_"
            }

            return $tokenResponse
        }

        function Get-AzDoToken {
            $token = Get-AzDoTokenHelper
            $token = $token | Out-String
            $token = $token.Substring(4).Trim()
            return $token
        }
        
    ' + $joinedContents

    if ($input_showWarnings) {
        $joinedContents = '
            $warnings = New-Object System.Collections.ObjectModel.ObservableCollection[System.Management.Automation.WarningRecord];
            Register-ObjectEvent -InputObject $warnings -EventName CollectionChanged -Action {
                if($Event.SourceEventArgs.Action -like "Add"){
                    $Event.SourceEventArgs.NewItems | ForEach-Object {
                        Write-Host "##vso[task.logissue type=warning;]$_";
                    }
                }
            };
            Invoke-Command {' + $joinedContents + '} -WarningVariable +warnings';
    }

    # Write the script to disk.
    Assert-VstsAgent -Minimum '2.115.0'
    $tempDirectory = Get-VstsTaskVariable -Name 'agent.tempDirectory' -Require
    Assert-VstsPath -LiteralPath $tempDirectory -PathType 'Container'
    $filePath = [System.IO.Path]::Combine($tempDirectory, "$([System.Guid]::NewGuid()).ps1")
    $null = [System.IO.File]::WriteAllText(
        $filePath,
        $joinedContents,
        ([System.Text.Encoding]::UTF8))

    # Prepare the external command values.
    #
    # Note, use "-Command" instead of "-File". On PowerShell v4 and V3 when using "-File", terminating
    # errors do not cause a non-zero exit code.
    if ($input_pwsh) {
        $powershellPath = Get-Command -Name pwsh.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
    }
    else {
        $powershellPath = Get-Command -Name powershell.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
    }
    $executionOperator;
    if ($input_runScriptInSeparateScope) {
        $executionOperator = '&'; 
    }
    else {
        $executionOperator = '.';
    }
    Assert-VstsPath -LiteralPath $powershellPath -PathType 'Leaf'
    $arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command `"$executionOperator '$($filePath.Replace("'", "''"))'`""
    $splat = @{
        'FileName'         = $powershellPath
        'Arguments'        = $arguments
        'WorkingDirectory' = $input_workingDirectory
    }

    # Switch to "Continue".
    $global:ErrorActionPreference = 'Continue'
    $failed = $false
    
    # Run the script.
    Write-Host '========================== Starting Command Output ==========================='
    if (!$input_failOnStderr) {
        Invoke-VstsTool @splat
    }
    else {
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
            }
            else {
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
    }
    else {
        if ($LASTEXITCODE -ne 0) {
            $failed = $true
            Write-VstsTaskError -Message (Get-VstsLocString -Key 'PS_ExitCode' -ArgumentList $LASTEXITCODE)
        }
    }

    # Fail if any errors.
    if ($failed) {
        Write-VstsSetResult -Result 'Failed' -Message "Error detected" -DoNotThrow
    }
}
catch {
    Write-VstsTaskError -Message $_.Exception.Message
    Write-VstsSetResult -Result 'Failed' -Message "Error detected" -DoNotThrow
}
finally {
    # Signal Script A to exit
    $exitSignal = "Global\ExitSignal"
    $eventExit = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $exitSignal)
    $eventExit.Set()
    Write-Host "Exit signal sent to Task."
    Trace-VstsLeavingInvocation $MyInvocation
}