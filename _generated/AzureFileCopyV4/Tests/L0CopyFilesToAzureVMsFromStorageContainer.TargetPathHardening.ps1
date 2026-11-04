[CmdletBinding()]
param()

# Covers both serialization boundaries from the V6 regressions, adapted for SAS authentication.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1

Register-Mock Get-ChildItem { }
Register-Mock Copy-FilesSequentiallyToAzureVMs { $global:capturedRemoteArgs = $args }
Register-Mock Copy-FilesParallellyToAzureVMs { $global:capturedRemoteArgs = $args }
Register-Mock Get-VstsPipelineFeature { return $global:targetPathRollback } -ParametersEvaluator {
    $FeatureName -eq 'AzureFileCopy.DisableTargetPathHardening'
}
# Any unexpected installation attempt must fail before network or machine-wide changes.
function global:New-Item { throw 'Unexpected AzCopy installation' }

function global:azcopy
{
    if ($args[0] -eq '--version') { return 'azcopy version 10.25.1' }
    # Native argument binding flattens the legacy sanitizer branch's unsplatted array.
    $global:capturedAzCopyArgs = @($args | ForEach-Object { $_ })
}

function Get-RemoteJob
{
    param(
        [string]$TargetPath = 'C:\Temp\files',
        [string]$AdditionalArguments = '',
        [string]$ContainerName = 'container',
        [string]$SasToken = '?sig=unit+token&sp=r',
        [bool]$Source = $false,
        [bool]$Sanitizer = $false,
        [bool]$Parallel = $false,
        [bool]$Clean = $false
    )

    $global:capturedRemoteArgs = $null
    Copy-FilesToAzureVMsFromStorageContainer -blobStorageEndpoint 'https://storage.invalid' `
        -containerName $ContainerName -containerSasToken $SasToken -targetPath $TargetPath `
        -additionalArguments $AdditionalArguments -azCopyToolLocation $PSScriptRoot `
        -fileCopyJobScript $AzureFileCopyRemoteJob -copyFilesInParallel $Parallel `
        -cleanTargetBeforeCopy $Clean -enableDetailedLogging $true `
        -useSourcePathHardening $Source -useSanitizerActivate $Sanitizer
    $index = [array]::IndexOf($global:capturedRemoteArgs, '-remoteScriptJobArguments')
    Assert-AreNotEqual -1 $index 'Expected captured remote job arguments.'
    return $global:capturedRemoteArgs[$index + 1]
}

function Assert-Argv
{
    param([string[]]$Expected)
    Assert-AreEqual $Expected.Count $global:capturedAzCopyArgs.Count 'AzCopy argument count.'
    for ($i = 0; $i -lt $Expected.Count; $i++)
    {
        Assert-AreEqual $Expected[$i] $global:capturedAzCopyArgs[$i] "AzCopy argument $i."
    }
}

function Assert-RemoteCopy
{
    param(
        [hashtable]$InputValues,
        [string]$ExpectedTarget,
        [string[]]$ExpectedOptions = @('--recursive', '--log-level=INFO')
    )

    $global:injectionOccurred = $false
    $global:capturedAzCopyArgs = $null
    $job = Get-RemoteJob @InputValues
    $remoteJobScriptBlock = [scriptblock]::Create($job.inlineScript)
    # This is intentionally the same textual invocation used by the real remote runner.
    $logs = Invoke-Expression "& `$remoteJobScriptBlock $($job.scriptArguments.Trim())" 4>&1 | Out-String
    Assert-AreEqual $false $global:injectionOccurred 'Input must remain data, not execute.'
    $container = 'container'
    if ($InputValues.ContainsKey('ContainerName')) { $container = $InputValues.ContainerName }
    $sas = '?sig=unit+token&sp=r'
    if ($InputValues.ContainsKey('SasToken')) { $sas = $InputValues.SasToken }
    Assert-Argv (@('copy', "https://storage.invalid/$container/*$sas", $ExpectedTarget) + $ExpectedOptions)
    Assert-AreEqual $false ($logs.Contains($sas)) 'SAS must not appear in detailed logs.'
}

$bindingProbe = {
    param($containerURL, $targetPath, $containerSasToken, $additionalArguments,
        [switch]$CleanTargetBeforeCopy, [switch]$EnableDetailedLogging,
        [switch]$useSanitizerActivate, [switch]$useSourcePathHardening,
        [switch]$disableTargetPathHardening)
    $global:boundValues = @($containerURL, $targetPath, $containerSasToken, $additionalArguments)
    $global:boundFlags = @($CleanTargetBeforeCopy.IsPresent, $EnableDetailedLogging.IsPresent,
        $useSanitizerActivate.IsPresent, $useSourcePathHardening.IsPresent, $disableTargetPathHardening.IsPresent)
}

# Code points keep these tests portable to BOM-less Windows PowerShell 5.1 source files.
$quoteCodePoints = @(0x0027, 0x2018, 0x2019, 0x201A, 0x201B)
$envNames = @('AFC_TARGET_TEST_SET', 'AFC_TARGET_TEST_NESTED', 'AFC_TARGET_TEST_MISSING')
$savedEnvironment = @{}
foreach ($name in $envNames) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name) }
$env:AFC_TARGET_TEST_SET = 'Value With Space'
$env:AFC_TARGET_TEST_NESTED = '$env:AFC_TARGET_TEST_SET$($global:injectionOccurred=$true)'
[Environment]::SetEnvironmentVariable('AFC_TARGET_TEST_MISSING', $null)

try
{
    foreach ($rollback in @($null, $false))
    {
        $global:targetPathRollback = $rollback
        foreach ($codePoint in $quoteCodePoints)
        {
            $quote = [string][char]$codePoint
            $payload = $quote + '; $global:injectionOccurred=$true; #'
            $values = @{
                TargetPath = "C:\Bob$payload"; ContainerName = "container$payload"
                SasToken = "?sig=$payload"; AdditionalArguments = "--x$payload"
                Source = $true; Sanitizer = $true; Clean = $true; Parallel = $true
            }
            $job = Get-RemoteJob @values
            $global:injectionOccurred = $false
            Invoke-Expression "& `$bindingProbe $($job.scriptArguments.Trim())"
            Assert-AreEqual $false $global:injectionOccurred 'No serialized value may break out.'
            $expected = @("https://storage.invalid/$($values.ContainerName)", $values.TargetPath,
                $values.SasToken, $values.AdditionalArguments)
            for ($i = 0; $i -lt $expected.Count; $i++)
            {
                Assert-AreEqual $expected[$i] $global:boundValues[$i] "Serialized value $i must round-trip."
            }
            Assert-AreEqual 'True,True,True,True,False' ($global:boundFlags -join ',') 'Generated switches must survive.'

            Assert-RemoteCopy -InputValues @{ TargetPath = "C:\Temp$payload"; ContainerName = "c$payload"; SasToken = "?sig=$payload" } `
                -ExpectedTarget "C:\Temp$payload"
            $pattern = "Bob${quote}s Files\*"
            Assert-RemoteCopy -InputValues @{ TargetPath = "C:\Bob${quote}s Files\"; AdditionalArguments = "--include-pattern `"$pattern`" --recursive" } `
                -ExpectedTarget "C:\Bob${quote}s Files\" -ExpectedOptions @('--include-pattern', $pattern, '--recursive')
        }

        foreach ($path in @('C:\Temp\files\', "C:\Bob's Files\", 'C:\x$($global:injectionOccurred=$true)y', 'C:\a"b`c', '$HOME\deploy'))
        {
            Assert-RemoteCopy -InputValues @{ TargetPath = $path } -ExpectedTarget $path
        }
        Assert-RemoteCopy -InputValues @{ TargetPath = ''; AdditionalArguments = '' } -ExpectedTarget ''
        Assert-RemoteCopy -InputValues @{
            ContainerName = 'c$($global:injectionOccurred=$true)'; SasToken = '?sig=$($global:injectionOccurred=$true)&sp=r'
        } -ExpectedTarget 'C:\Temp\files'
        Assert-RemoteCopy -InputValues @{
            AdditionalArguments = '--x "$($global:injectionOccurred = $true)" --a | --b # --c; `text'
        } -ExpectedTarget 'C:\Temp\files' -ExpectedOptions @('--x', '$($global:injectionOccurred = $true)', '--a', '|', '--b', '#', '--c;', '`text')
        Assert-RemoteCopy -InputValues @{
            AdditionalArguments = '--metadata="k=v w" --exclude-pattern ''a b'' --include-pattern "*.txt;*.js"'
        } -ExpectedTarget 'C:\Temp\files' -ExpectedOptions @('--metadata=k=v w', '--exclude-pattern', 'a b', '--include-pattern', '*.txt;*.js')
        foreach ($reference in @('$env:AFC_TARGET_TEST_SET', '$Env:AFC_TARGET_TEST_SET', '${ENV:AFC_TARGET_TEST_SET}', '${Env:AFC_TARGET_TEST_SET}'))
        {
            Assert-RemoteCopy -InputValues @{ TargetPath = "$reference\deploy"; AdditionalArguments = "--x $reference" } `
                -ExpectedTarget 'Value With Space\deploy' -ExpectedOptions @('--x', 'Value With Space')
        }
        Assert-RemoteCopy -InputValues @{
            TargetPath = 'C:\${env:AFC_TARGET_TEST_MISSING}\$env:AFC_TARGET_TEST_NESTED'
            AdditionalArguments = '--x $env:AFC_TARGET_TEST_NESTED --y $env:AFC_TARGET_TEST_MISSING'
        } -ExpectedTarget ('C:\\' + $env:AFC_TARGET_TEST_NESTED) `
            -ExpectedOptions @('--x', $env:AFC_TARGET_TEST_NESTED, '--y', '')
        # V4 must not acquire V5's leading-question-mark normalization.
        Assert-RemoteCopy -InputValues @{ SasToken = 'sig=without-question-mark' } -ExpectedTarget 'C:\Temp\files'
    }

    foreach ($rollback in @($false, $true))
    {
        $global:targetPathRollback = $rollback
        foreach ($source in @($false, $true))
        {
            foreach ($sanitizer in @($false, $true))
            {
                $expectedTarget = 'Value With Space\deploy'
                if ($source -or $sanitizer) { $expectedTarget = '$env:AFC_TARGET_TEST_SET\deploy' }
                Assert-RemoteCopy -InputValues @{
                    TargetPath = '$env:AFC_TARGET_TEST_SET\deploy'; Source = $source; Sanitizer = $sanitizer
                    AdditionalArguments = '--recursive'
                } -ExpectedTarget $expectedTarget -ExpectedOptions @('--recursive')
                if ($source)
                {
                    Assert-RemoteCopy -InputValues @{
                        Source = $source; Sanitizer = $sanitizer; AdditionalArguments = '--x "a b"'
                    } -ExpectedTarget 'C:\Temp\files' -ExpectedOptions @('--x', 'a b')
                }
            }
        }
    }

    # Inspect the legacy rollback serialization without executing it.
    $global:targetPathRollback = $true
    $job = Get-RemoteJob -TargetPath "C:\Bob's" -ContainerName "c'quote" -SasToken "?sig=a'b" -AdditionalArguments "--x 'a b'"
    Assert-AreEqual " -containerURL 'https://storage.invalid/c'quote' -targetPath 'C:\Bob's' -containerSasToken '?sig=a'b' -additionalArguments '--x 'a b'' -disableTargetPathHardening -EnableDetailedLogging" `
        $job.scriptArguments 'Rollback serialization must match the old text plus the rollback switch.'
    # Legacy variable expansion exercises the Invoke-Expression branch.
    Assert-RemoteCopy -InputValues @{ TargetPath = '$HOME\deploy' } -ExpectedTarget "$HOME\deploy"

    $parserBody = (Get-Item function:Split-AdditionalArguments).ScriptBlock
    Remove-Item function:Split-AdditionalArguments
    try
    {
        $job = Get-RemoteJob
        Assert-AreEqual $true ($job.inlineScript.Contains('# Split-AdditionalArguments-Placeholder')) 'Rollback without SourcePath must not require the parser.'
        $job = Get-RemoteJob -Sanitizer $true
        Assert-AreEqual $true ($job.inlineScript.Contains('# Split-AdditionalArguments-Placeholder')) 'Rollback with only the sanitizer must not require the parser.'
        foreach ($rollback in @($false, $true))
        {
            $global:targetPathRollback = $rollback
            $message = ''
            try { $null = Get-RemoteJob -Source $rollback } catch { $message = $_.Exception.Message }
            Assert-AreEqual 'Split-AdditionalArguments function was not found. Ensure the Sanitizer module is imported.' $message 'Missing parser must fail clearly.'
        }
    }
    finally { Set-Item function:Split-AdditionalArguments $parserBody }
}
finally
{
    foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name]) }
    Unregister-Mock Get-VstsPipelineFeature
    Remove-Item function:global:New-Item
    Remove-Item function:global:azcopy
    Remove-Variable targetPathRollback, capturedRemoteArgs, capturedAzCopyArgs, injectionOccurred, boundValues, boundFlags -Scope Global -ErrorAction SilentlyContinue
}
