Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

# Get inputs.
$scriptType = Get-VstsInput -Name ScriptType -Require
$scriptPath = Get-VstsInput -Name ScriptPath
$scriptInline = Get-VstsInput -Name Inline
$scriptArguments = Get-VstsInput -Name ScriptArguments
$targetAzurePs = Get-VstsInput -Name TargetAzurePs
$customTargetAzurePs = Get-VstsInput -Name CustomTargetAzurePs

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

if($targetAzurePs -eq "OtherVersion") {
    $targetAzurePs = $customTargetAzurePs.Trim()
}
$targetAzurePs = Update-PSModulePath -targetAzurePs $targetAzurePs
try {
    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Initialize-Azure -azurePsVersion $targetAzurePs
    # Trace the expression as it will be invoked.
    $__vstsAzPSInlineScriptPath = $null
    If ($scriptType -eq "InlineScript") {
        $__vstsAzPSInlineScriptPath = [System.IO.Path]::Combine(([System.IO.Path]::GetTempPath()), ([guid]::NewGuid().ToString() + ".ps1"));
        ($scriptInline | Out-File $__vstsAzPSInlineScriptPath)
        $scriptPath = $__vstsAzPSInlineScriptPath
    }

    $scriptCommand = "& '$($scriptPath.Replace("'", "''"))' $scriptArguments"
    Remove-Variable -Name scriptType
    Remove-Variable -Name scriptPath
    Remove-Variable -Name scriptInline
    Remove-Variable -Name scriptArguments

    # Remove all commands imported from VstsTaskSdk, other than Out-Default.
    # Remove all commands imported from VstsAzureHelpers_.
    Get-ChildItem -LiteralPath function: |
        Where-Object {
            ($_.ModuleName -eq 'VstsTaskSdk' -and $_.Name -ne 'Out-Default') -or
            ($_.Name -eq 'Invoke-VstsTaskScript') -or
            ($_.ModuleName -eq 'VstsAzureHelpers_' )
        } |
        Remove-Item

    # For compatibility with the legacy handler implementation, set the error action
    # preference to continue. An implication of changing the preference to Continue,
    # is that Invoke-VstsTaskScript will no longer handle setting the result to failed.
    $global:ErrorActionPreference = 'Continue'

    # Undocumented VstsTaskSdk variable so Verbose/Debug isn't converted to ##vso[task.debug].
    # Otherwise any content the ad-hoc script writes to the verbose pipeline gets dropped by
    # the agent when System.Debug is not set.
    $global:__vstsNoOverrideVerbose = $true

    # Run the user's script. Redirect the error pipeline to the output pipeline to enable
    # a couple goals due to compatibility with the legacy handler implementation:
    # 1) STDERR from external commands needs to be converted into error records. Piping
    #    the redirected error output to an intermediate command before it is piped to
    #    Out-Default will implicitly perform the conversion.
    # 2) The task result needs to be set to failed if an error record is encountered.
    #    As mentioned above, the requirement to handle this is an implication of changing
    #    the error action preference.
    ([scriptblock]::Create($scriptCommand)) |
        ForEach-Object {
            Remove-Variable -Name scriptCommand
            Write-Host "##[command]$_"
            . $_ 2>&1
        } |
        ForEach-Object {
            # Put the object back into the pipeline. When doing this, the object needs
            # to be wrapped in an array to prevent unraveling.
            ,$_

            # Set the task result to failed if the object is an error record.
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                "##vso[task.complete result=Failed]"
            }
        }
}
finally {
    if ($__vstsAzPSInlineScriptPath -and (Test-Path -LiteralPath $__vstsAzPSInlineScriptPath) ) {
        Remove-Item -LiteralPath $__vstsAzPSInlineScriptPath -ErrorAction 'SilentlyContinue'
    }
}

function Update-PSModulePath {
    [CmdletBinding()]
    param([string] $targetAzurePs)

    $pattern = "^[0-9]+\.[0-9]+\.[0-9]+$"
    $regex = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

    if ($regex.IsMatch($targetAzurePs)) {
        $hostedAgentAzureRmModulePath = $env:SystemDrive + "\Modules\AzureRm_" + $targetAzurePs
        $hostedAgentAzureModulePath = $env:SystemDrive + "\Modules\Azure_" + $targetAzurePs
    }
    elseif ($targetAzurePs -eq "LatestVersion") {
        # For Hosted Agent, the Latest Version is 4.1.0
        $hostedAgentAzureRmModulePath = Get-LatestModule -patternToMatch "^azurerm_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        $hostedAgentAzureModulePath =   Get-LatestModule -patternToMatch "^azure_[0-9]+\.[0-9]+\.[0-9]+$"   -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        $targetAzurePs = ""
    }
    else {
        throw (Get-VstsLocString -Key InvalidVersion -ArgumentList $targetAzurePs)
    }
    $env:PSModulePath = $hostedAgentAzureRmModulePath + ";" + $hostedAgentAzureModulePath + ";" + $env:PSModulePath
    $env:PSModulePath.TrimStart(';')
    return $targetAzurePs
}

function Get-LatestModule {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)
    
    $resultFolder = ""
    try {
        $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
        $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
        $moduleFolders = Get-ChildItem -Directory -Path [Sytem.IO.Path]::Combine($env:SystemDrive,"Modules") | Where-Object { $regexToMatch.IsMatch($_.Name) }

        $maxVersion = [version] "0.0.0"
        foreach ($moduleFolder in $moduleFolders) 
        {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion)
            {
                $maxVersion = $moduleVersion
                $resultFolder = $moduleFolder.FullName
            }
        }
    }
    catch {
        Write-Verbose "Attempting to find the Latest Module Folder failed with the error: $($_.Exception.Message)"
        $resultFolder = ""
    }
    return $resultFolder
}
