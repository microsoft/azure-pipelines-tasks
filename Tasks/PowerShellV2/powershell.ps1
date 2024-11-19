[CmdletBinding()]
param()

Import-Module $PSScriptRoot\ps_modules\Sanitizer
Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_ 
Import-Module $PSScriptRoot\ps_modules\VstsTaskSdk 
Import-Module $PSScriptRoot\ps_modules\TlsHelper_

. $PSScriptRoot\helpers.ps1

$global:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require

class ADOToken {

    [void] StartNamedPiped() {
            $pipe = New-Object System.IO.Pipes.NamedPipeServerStream("PowershellV2TaskPipe","InOut")
            $global:waitForPipe = $false
            
            Write-Host "Pipe Waiting for a connection..."
            $pipe.WaitForConnection()
            Write-Host "Client connected."
        
            $reader = New-Object System.IO.StreamReader($pipe)
            
            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line) { break }
                if($line -eq "Stop-Pipe") {break}
                
                try {
                    [string]$connectedServiceName = (Get-VstsInput -Name ConnectedServiceName)
            
                    $global:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require
                    
                    $token = ""

                    if ($null -eq $connectedServiceName -or $connectedServiceName -eq [string]::Empty) {
                        Write-Host "No Service connection was found, returning the System Access Token"
                        $token = $global:SystemAccessTokenPowershellV2
                    } 
                    else 
                    {
                        $vstsEndpoint = Get-VstsEndpoint -Name $connectedServiceName -Require

                        $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint `
                            -connectedServiceNameARM $connectedServiceName `
                            -scope "499b84ac-1321-427f-aa17-267ca6975798"

                        $token = $result.AccessToken

                        if ($null -eq $token -or $token -eq [string]::Empty) {
                            Write-Host "Generated token found to be null, returning the System Access Token"
                            $token = $global:SystemAccessTokenPowershellV2
                        } else {
                            Write-Host "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
                        }
                    }                    
                }
                catch {
                    Write-Host "Failed to generate token with message $_, returning the System Access Token"
                    $token = $global:SystemAccessTokenPowershellV2
                } finally {
                    $writer = New-Object System.IO.StreamWriter($pipe)
                    $writer.WriteLine($token)
                    $writer.Flush()
                }
            }
        
            Write-Host "Closing the pipe"
            $reader.Close()
            $pipe.Close()
    }
}

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

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\task.json"

    # Create a runspace to handle the Get-DerivedValue function
    $runspacePool = [runspacefactory]::CreateRunspacePool(1, 1)
    $runspacePool.Open()

    $global:waitForPipe = $true
    
    $myObject = [ADOToken]::new()
    # Create a PowerShell instance within the runspace pool
    $psRunspace = [powershell]::Create().AddScript({
        param($obj)
        try {
            $result = $obj.StartNamedPiped()
            return $result
        } catch {
            return $_
        }    
    }).AddArgument($myObject)

    $psRunspace.RunspacePool = $runspacePool
    Write-Host "Starting Pipe......."
    $psRunspace.BeginInvoke()

    while($global:waitForPipe) {
        Write-Host "Waiting for the pipe to start......."
        Start-Sleep -Seconds 1
    }
    Start-Sleep -Seconds 1

    
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
        
        $AzDoTokenPipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "PowershellV2TaskPipe", [System.IO.Pipes.PipeDirection]::InOut)
        Write-Host "Trying connect to the server."
        $AzDoTokenPipe.Connect(10000)
        Write-Host "Connected to the server."
        
        function Get-AzDoToken {
            try {
                $writer = New-Object System.IO.StreamWriter($AzDoTokenPipe)
                $reader = New-Object System.IO.StreamReader($AzDoTokenPipe)

                $input = "Get-AzDoToken"
                
                # Send command to the server
                $writer.WriteLine($input)
                $writer.Flush()
                
                $response = $reader.ReadLine()
                return $response
            }
            catch {
                Write-Host "Error in Get-AzDoToken: $_"
                return $global:SystemAccessTokenPowershellV2
            }
        }
        
        ' + $joinedContents;

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

    $joinedContents = 'try { '+ $joinedContents + '}
        finally {
            $writer = New-Object System.IO.StreamWriter($AzDoTokenPipe)
            $input = "Stop-Pipe"
            # Send command to the server
            $writer.WriteLine($input)
            $writer.Flush()
        }'

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
    # Clean up runspace resources
    $psRunspace.Dispose()
    $runspacePool.Close()
    $runspacePool.Dispose()
    Trace-VstsLeavingInvocation $MyInvocation
}
