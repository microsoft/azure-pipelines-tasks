# See Tasks\AzurePowerShell\AzurePowerShell.ps1 for the original inspiration

Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

# Get inputs.
$serviceConnectionName = Get-VstsInput -Name serviceConnectionName -Require
$scriptType = Get-VstsInput -Name ScriptType -Require
$scriptPath = Get-VstsInput -Name ScriptPath
$scriptInline = Get-VstsInput -Name Inline
$scriptArguments = Get-VstsInput -Name ScriptArguments

# Validate the script path and args do not contains new-lines. Otherwise, it will
# break invoking the script via Invoke-Expression.
if ($scriptType -eq "FilePath")
{
    if ($scriptPath -match '[\r\n]' -or [string]::IsNullOrWhitespace($scriptPath))
    {
        throw (Get-VstsLocString -Key InvalidScriptPath0 -ArgumentList $scriptPath)
    }
}
else {
    $scriptPath = "";  # This will be set below.
}

if ($scriptArguments -match '[\r\n]')
{
    throw (Get-VstsLocString -Key InvalidScriptArguments0 -ArgumentList $scriptArguments)
}

$certificate = $null
try
{
    # Initialize Service Fabric.
    Import-Module $PSScriptRoot\ps_modules\ServiceFabricHelpers

    $global:operationId = $SF_Operations.Undefined
    $connectedServiceEndpoint = Get-VstsEndpoint -Name $serviceConnectionName -Require
    $clusterConnectionParameters = @{}

    try
    {
        $certificate = Connect-ServiceFabricClusterFromServiceEndpoint -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $connectedServiceEndpoint
    }
    catch
    {
        Publish-Telemetry -TaskName 'ServiceFabricPowerShell' -OperationId $global:operationId  -ErrorData $_
        throw
    }

    # Trace the expression as it will be invoked.
    If ($scriptType -eq "InlineScript")
    {
        $tempFileName = [guid]::NewGuid().ToString() + ".ps1";
        $scriptPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), $tempFileName);
        ($scriptInline | Out-File $scriptPath)
    }

    $scriptCommand = "& '$($scriptPath.Replace("'", "''"))' $scriptArguments"
    Remove-Variable -Name scriptArguments

    # Remove all commands imported from VstsTaskSdk, other than Out-Default.
    # Remove all commands imported from ServiceFabricHelpers.
    Get-ChildItem -LiteralPath function: |
        Where-Object {
        ($_.ModuleName -eq 'VstsTaskSdk' -and $_.Name -ne 'Out-Default') -or
        ($_.Name -eq 'Invoke-VstsTaskScript') -or
        ($_.ModuleName -eq 'ServiceFabricHelpers' )
    } |
        Remove-Item

    # For compatibility with the legacy handler implementation, set the error action
    # preference to continue. An implication of changing the preference to Continue,
    # is that Invoke-VstsTaskScript will no longer handle setting the result to failed.
    $global:ErrorActionPreference = 'Continue'

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
        , $_

        # Set the task result to failed if the object is an error record.
        if ($_ -is [System.Management.Automation.ErrorRecord])
        {
            "##vso[task.complete result=Failed]"
        }
    }
}
catch
{
    if ($null -ne $certificate)
    {
        $thumbprint = $certificate.Thumbprint
        if (!(Test-Path "Cert:\CurrentUser\My\$thumbprint"))
        {
            Write-Warning (Get-VstsLocString -Key CertNotPresentInLocalStoreWarningMsg -ArgumentList $thumbprint)
        }
    }
    throw
}
Finally
{
    If ($scriptType -eq "InlineScript" -and $scriptPath -and (Test-Path -LiteralPath $scriptPath))
    {
        Remove-Item -LiteralPath $scriptPath -Force -ErrorAction 'SilentlyContinue' | Out-Null
    }

    Remove-Variable -Name scriptPath

    # Can't use Remove-ClientCertificate as we removed all funcitons above
    try
    {
        if ($null -ne $certificate)
        {
            $thumbprint = $certificate.Thumbprint
            if (Test-Path "Cert:\CurrentUser\My\$thumbprint")
            {
                Remove-Item "Cert:\CurrentUser\My\$thumbprint" -Force
            }
        }
    }
    catch
    {
        Write-Warning $_
    }
}

# We don't call Trace-VstsLeavingInvocation at the end because that command was removed prior to calling the user script.