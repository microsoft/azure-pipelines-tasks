Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

# Get inputs.
$scriptType = Get-VstsInput -Name ScriptType -Require
$scriptPath = Get-VstsInput -Name ScriptPath
$scriptInline = Get-VstsInput -Name Inline
$scriptArguments = Get-VstsInput -Name ScriptArguments
$__vsts_input_errorActionPreference = Get-VstsInput -Name errorActionPreference
$__vsts_input_failOnStandardError = Get-VstsInput -Name FailOnStandardError -AsBool
$targetAzurePs = Get-VstsInput -Name TargetAzurePs
$customTargetAzurePs = Get-VstsInput -Name CustomTargetAzurePs
$input_pwsh = Get-VstsInput -Name pwsh -AsBool
$input_workingDirectory = Get-VstsInput -Name workingDirectory -Require
$validateScriptSignature = Get-VstsInput -Name validateScriptSignature -AsBool

# Validate the script path and args do not contains new-lines. Otherwise, it will
# break invoking the script via Invoke-Expression.
if ($scriptType -eq "FilePath") {
    if ($scriptPath -match '[\r\n]' -or [string]::IsNullOrWhitespace($scriptPath)) {
        throw (Get-VstsLocString -Key InvalidScriptPath0 -ArgumentList $scriptPath)
    }
}

if ($scriptArguments -match '[\r\n]') {
    throw (Get-VstsLocString -Key InvalidScriptArguments0 -ArgumentList $scriptArguments)
}

# string constants
$otherVersion = "OtherVersion"
$latestVersion = "LatestVersion"

if ($targetAzurePs -eq $otherVersion) {
    if ($customTargetAzurePs -eq $null) {
        throw (Get-VstsLocString -Key InvalidAzurePsVersion $customTargetAzurePs)
    } else {
        $targetAzurePs = $customTargetAzurePs.Trim()
    }
}

$pattern = "^[0-9]+\.[0-9]+\.[0-9]+$"
$regex = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

if ($targetAzurePs -eq $latestVersion) {
    $targetAzurePs = ""
} elseif (-not($regex.IsMatch($targetAzurePs))) {
    throw (Get-VstsLocString -Key InvalidAzurePsVersion -ArgumentList $targetAzurePs)
}

. $PSScriptRoot\TryMakingModuleAvailable.ps1 -targetVersion "$targetAzurePs" -platform Windows

if ($validateScriptSignature) {
    try {
        if ($scriptType -ne "InlineScript") {
            Write-Host "## Validating Script Signature"

            # Validate script is signed
            $scriptSignature = Get-AuthenticodeSignature $scriptPath
            if ($scriptSignature.Status -eq "NotSigned") {
                throw "Object does not have a digital signature. Please ensure your script is signed and try again."
            }
            elseif ($scriptSignature.Status -ne "Valid") {
                throw "Digital signature of the object did not verify. Please ensure your script is properly signed and try again."
            }

            Write-Host "## Validating Script Signature Complete" 
        }
    }
    catch 
    {
        $errorMsg = $_.Exception.Message
        throw "Unable to validate script signature: $errorMsg"
    }
}

. "$PSScriptRoot\Utility.ps1"

$serviceName = Get-VstsInput -Name ConnectedServiceNameARM -Require
$endpointObject = Get-VstsEndpoint -Name $serviceName -Require
$endpoint = ConvertTo-Json $endpointObject

try 
{
    # Generate the script contents.
    Write-Host (Get-VstsLocString -Key 'GeneratingScript')
    $contents = @()
    $contents += "`$ErrorActionPreference = '$__vsts_input_errorActionPreference'"
    if ($env:system_debug -eq "true") {
        $contents += "`$VerbosePreference = 'continue'"
    }

    $CoreAzArgument = $null;
    if ($targetAzurePs) {
        $CoreAzArgument = "-endpoint '$endpoint' -targetAzurePs $targetAzurePs"
    } else {
        $CoreAzArgument = "-endpoint '$endpoint'"
    }
    $contents += ". '$PSScriptRoot\CoreAz.ps1' $CoreAzArgument"

    if ($scriptType -eq "InlineScript") {
        $contents += "$scriptInline".Replace("`r`n", "`n").Replace("`n", "`r`n")
    } else {
        $contents += ". '$("$scriptPath".Replace("'", "''"))' $scriptArguments".Trim()
    }

    # Write the script to disk.
    $__vstsAzPSScriptPath = [System.IO.Path]::Combine($env:Agent_TempDirectory, ([guid]::NewGuid().ToString() + ".ps1"));
    $joinedContents = [System.String]::Join(
        ([System.Environment]::NewLine),
        $contents)
    $null = [System.IO.File]::WriteAllText(
        $__vstsAzPSScriptPath,
        $joinedContents,
        ([System.Text.Encoding]::UTF8))

    # Prepare the external command values.
    #
    # Note, use "-Command" instead of "-File". On PowerShell V5, V4 and V3 when using "-File", terminating
    # errors do not cause a non-zero exit code.
    if ($input_pwsh) {
        $powershellPath = Get-Command -Name pwsh.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
    } else {
        $powershellPath = Get-Command -Name powershell.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
    }
    Assert-VstsPath -LiteralPath $powershellPath -PathType 'Leaf'
    $arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command `". '$($__vstsAzPSScriptPath.Replace("'", "''"))'`""
    $splat = @{
        'FileName' = $powershellPath
        'Arguments' = $arguments
        'WorkingDirectory' = $input_workingDirectory
    }

    # Switch to "Continue".
    $global:ErrorActionPreference = 'Continue'
    $failed = $false

    # Run the script.
    Write-Host '========================== Starting Command Output ==========================='
    if (!$__vsts_input_failOnStandardError) {
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
                } else {
                    # Flush the error buffer.
                    if ($inError) {
                        $inError = $false
                        $message = $errorLines.ToString().Trim()
                        $null = $errorLines.Clear()
                        if ($message) {
                            Write-VstsTaskError -Message $message
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
                Write-VstsTaskError -Message $message
            }
        }
    }

    if ($LASTEXITCODE -ne 0) {
        $failed = $true
        Write-VstsTaskError -Message (Get-VstsLocString -Key 'PS_ExitCode' -ArgumentList $LASTEXITCODE)
    }

    # Fail if any errors.
    if ($failed) {
        Write-VstsSetResult -Result 'Failed' -Message "Error detected" -DoNotThrow
    }
}
finally {
    if ($__vstsAzPSInlineScriptPath -and (Test-Path -LiteralPath $__vstsAzPSInlineScriptPath) ) {
        Remove-Item -LiteralPath $__vstsAzPSInlineScriptPath -ErrorAction 'SilentlyContinue'
    }

    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Remove-EndpointSecrets
    Disconnect-AzureAndClearContext -ErrorAction SilentlyContinue
}