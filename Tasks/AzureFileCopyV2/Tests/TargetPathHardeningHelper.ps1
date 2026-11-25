# Shared setup for the serialization, v8 invocation and real-runner regressions.
$targetPathHardeningOriginalGlobals = @{}
foreach ($name in @('hardeningFeatureName', 'hardeningRollback', 'toolFile', 'generatedRemoteJob',
    'receivedRemoteValues', 'transferredPath', 'transferredContent', 'nativeArguments',
    'failNativeCopy', 'cleanupCalls', 'detailLogs', 'injectionOccurred', 'VerbosePreference', 'ErrorActionPreference'))
{
    $original = Get-Variable -Name $name -Scope Global -ErrorAction SilentlyContinue
    $targetPathHardeningOriginalGlobals[$name] = if ($null -ne $original) { @{ Value = $original.Value } } else { $null }
}
# Mock traces repeat the entire embedded script and base64 payload; task logs are asserted separately.
$global:VerbosePreference = 'SilentlyContinue'

function Restore-TargetPathHardeningTestState
{
    try
    {
        # Unregister-Mock itself uses Remove-Item; bypass that mock before removing any aliases.
        if (Get-Alias -Name Remove-Item -ErrorAction SilentlyContinue)
        {
            Set-Alias -Name Remove-Item -Value Microsoft.PowerShell.Management\Remove-Item -Scope Global -Force
        }
        foreach ($command in @('Remove-Item', 'Get-Content', 'Get-Item', 'Test-Path', 'Join-Path',
            'Get-Service', 'Invoke-RestMethod', 'Get-WmiObject', 'Copy-FilesParallellyToAzureVMs',
            'Copy-FilesSequentiallyToAzureVMs', 'Get-ChildItem', 'Get-VstsPipelineFeature', 'Import-Module'))
        {
            Unregister-Mock -Command $command
        }
    }
    finally
    {
        foreach ($name in $targetPathHardeningOriginalGlobals.Keys)
        {
            $original = $targetPathHardeningOriginalGlobals[$name]
            if ($null -ne $original) { Set-Variable -Name $name -Scope Global -Value $original.Value }
            else { Remove-Variable -Name $name -Scope Global -ErrorAction SilentlyContinue }
        }
    }
}

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1

$global:hardeningFeatureName = 'AzureFileCopy.DisableTargetPathHardening'
$global:hardeningRollback = $null
$global:toolFile = [pscustomobject]@{ Name = 'AzCopy.exe'; FullName = $PSCommandPath }
$toolContents = [Convert]::ToBase64String([IO.File]::ReadAllBytes($PSCommandPath))
Register-Mock Get-VstsPipelineFeature {
    param($FeatureName)
    Assert-AreEqual $global:hardeningFeatureName $FeatureName
    return $global:hardeningRollback
}
Register-Mock Get-ChildItem { return $global:toolFile }
Register-Mock Copy-FilesSequentiallyToAzureVMs {
    $index = [array]::IndexOf($args, '-remoteScriptJobArguments')
    $global:generatedRemoteJob = $args[$index + 1]
}
Register-Mock Copy-FilesParallellyToAzureVMs {
    $index = [array]::IndexOf($args, '-remoteScriptJobArguments')
    $global:generatedRemoteJob = $args[$index + 1]
}

function Get-GeneratedRemoteJob
{
    param([hashtable]$Overrides = @{})

    $parameters = @{
        blobStorageEndpoint = 'https://storage.invalid'
        containerName = 'files'
        containerSasToken = 'sig=secret&sp=r'
        targetPath = "C:\Bob's Files\"
        additionalArguments = ''
        azCopyToolLocation = 'AzCopy'
        fileCopyJobScript = $AzureFileCopyRemoteJob
        cleanTargetBeforeCopy = $false
        enableDetailedLogging = $false
        copyFilesInParallel = $false
    }
    foreach ($key in $Overrides.Keys) { $parameters[$key] = $Overrides[$key] }
    $global:generatedRemoteJob = $null
    Copy-FilesToAzureVMsFromStorageContainer @parameters
    Assert-IsNotNullOrEmpty $global:generatedRemoteJob
    return $global:generatedRemoteJob
}

$captureRemoteJob = {
    param(
        [string]$containerURL, [string]$targetPath, [string]$containerSasToken,
        [string]$additionalArguments, [string]$azCopyToolFileNamesString,
        [string]$azCopyToolFileContentsString, [switch]$CleanTargetBeforeCopy,
        [switch]$EnableDetailedLogging, [switch]$useSanitizerActivate,
        [switch]$useSourcePathHardening, [switch]$disableTargetPathHardening
    )
    $global:receivedRemoteValues = $PSBoundParameters
}

function Invoke-CapturedRemoteJob
{
    param($Job, [scriptblock]$RemoteJob = $captureRemoteJob)

    # This intentionally reproduces the runner's scriptArguments evaluation boundary.
    Invoke-Expression "& `$RemoteJob $($Job.scriptArguments.Trim())"
}

function Assert-Argv
{
    param([object[]]$Expected, [object[]]$Actual)

    Assert-AreEqual $Expected.Count $Actual.Count 'Native argument count'
    for ($i = 0; $i -lt $Expected.Count; $i++)
    {
        Assert-AreEqual $Expected[$i] $Actual[$i] "Native argument $i"
    }
}
