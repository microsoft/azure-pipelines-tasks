[CmdletBinding()]
param()

& {
try
{
. $PSScriptRoot\TargetPathHardeningHelper.ps1

# Codepoints keep these tests portable to BOM-less Windows PowerShell 5.1 files.
foreach ($codepoint in @(0x27, 0x2018, 0x2019, 0x201A, 0x201B))
{
    $value = 'x' + [char]$codepoint + '; $global:injectionOccurred=$true; #'
    $global:toolFile.Name = $value
    foreach ($sourceHardening in @($false, $true))
    {
        foreach ($sanitizer in @($false, $true))
        {
            $global:injectionOccurred = $false
            $job = Get-GeneratedRemoteJob @{
                containerName = $value; targetPath = $value; containerSasToken = $value
                additionalArguments = $value; useSourcePathHardening = $sourceHardening
                useSanitizerActivate = $sanitizer; cleanTargetBeforeCopy = $true
                enableDetailedLogging = $true; copyFilesInParallel = $sanitizer
            }
            Invoke-CapturedRemoteJob $job
            Assert-AreEqual $false $global:injectionOccurred
            foreach ($name in @('targetPath', 'containerSasToken', 'additionalArguments', 'azCopyToolFileNamesString'))
            {
                Assert-AreEqual $value $global:receivedRemoteValues[$name] "Quote U+$codepoint in $name"
            }
            Assert-AreEqual "https://storage.invalid/$value" $global:receivedRemoteValues.containerURL
            Assert-AreEqual $toolContents $global:receivedRemoteValues.azCopyToolFileContentsString
            Assert-AreEqual $true $global:receivedRemoteValues.CleanTargetBeforeCopy.IsPresent
            Assert-AreEqual $true $global:receivedRemoteValues.EnableDetailedLogging.IsPresent
            Assert-AreEqual $sourceHardening ([bool]$global:receivedRemoteValues.useSourcePathHardening)
            Assert-AreEqual $sanitizer ([bool]$global:receivedRemoteValues.useSanitizerActivate)
            Assert-AreEqual $false $job.inlineScript.Contains('# Split-AdditionalArguments-Placeholder')
        }
    }
}
$global:toolFile.Name = 'AzCopy.exe'

# Substitute the unmockable static file write and executable lookup. Setup, parsing and cleanup
# remain the production script; no executable or directory is written to the machine.
function Write-TransferredTool($Path, $Content)
{
    $global:transferredPath = $Path
    $global:transferredContent = [Convert]::ToBase64String($Content)
}
function Invoke-MockedAzCopy
{
    # Native commands flatten arrays, unlike a PowerShell function's raw $args.
    $global:nativeArguments = @($args | ForEach-Object { $_ })
    if ($global:failNativeCopy) { throw 'Mock native copy failed' }
}
function Capture-DetailLog($Message) { $global:detailLogs += $Message }
Register-Mock Join-Path {
    param($Path, $ChildPath)
    return [IO.Path]::Combine($Path, $ChildPath)
}
Register-Mock Test-Path { return $true }
Register-Mock Get-Item {
    param($Path)
    if ($Path -like 'function:*') { return Microsoft.PowerShell.Management\Get-Item -Path $Path -ErrorAction SilentlyContinue }
    return [pscustomobject]@{ Parent = @{ FullName = 'mock-parent' } }
}
Register-Mock Get-Content { return 'mock verbose log' }
Register-Mock Remove-Item { $global:cleanupCalls++ }
function New-Item { }

function Assert-RemoteArguments
{
    param([hashtable]$Overrides, [object[]]$Expected, [bool]$Defaults = $false)

    $global:injectionOccurred = $false
    $global:nativeArguments = $null
    $global:cleanupCalls = 0
    $global:detailLogs = @()
    $job = Get-GeneratedRemoteJob $Overrides
    Assert-AreEqual $true $job.inlineScript.Contains('[System.IO.File]::WriteAllBytes($path, $content)') 'Static write seam must match before execution'
    Assert-AreEqual $true $job.inlineScript.Contains('$azCopyExeLocation = Join-Path -Path $azCopyDestinationPath -ChildPath "AzCopy.exe"') 'Native command seam must match before execution'
    $source = $job.inlineScript.Replace('[System.IO.File]::WriteAllBytes($path, $content)', 'Write-TransferredTool $path $content')
    $source = $source.Replace('Write-Verbose $message', 'Capture-DetailLog $message')
    $source = $source.Replace('$azCopyExeLocation = Join-Path -Path $azCopyDestinationPath -ChildPath "AzCopy.exe"', '$azCopyExeLocation = "Invoke-MockedAzCopy"')
    Assert-AreNotEqual $job.inlineScript $source 'The static write must be intercepted'
    Invoke-CapturedRemoteJob $job ([scriptblock]::Create($source))
    Assert-AreEqual $false $global:injectionOccurred
    Assert-AreEqual $toolContents $global:transferredContent 'v8 tool transfer'
    Assert-AreEqual $true $global:transferredPath.EndsWith('\AzCopy\AzCopy.exe')
    Assert-AreEqual $true ($global:cleanupCalls -ge 3) 'Tool and parent folders cleaned'
    Assert-AreEqual $false (($global:detailLogs -join "`n").Contains('sig=secret&sp=r')) 'SAS must stay masked'
    if ($Overrides.enableDetailedLogging)
    {
        Assert-AreEqual $true (($global:detailLogs -join "`n").Contains('/SourceSAS:"*****"')) 'Detailed command log must mask the SAS'
    }
    if ($Defaults)
    {
        Assert-Argv $Expected $global:nativeArguments[0..2]
        Assert-AreEqual 7 $global:nativeArguments.Count
        $toolDirectory = [IO.Path]::GetDirectoryName($global:transferredPath)
        Assert-AreEqual "/Z:$toolDirectory" $global:nativeArguments[3]
        Assert-AreEqual $true $global:nativeArguments[4].StartsWith("/V:$toolDirectory\AzCopyVerbose_")
        Assert-AreEqual $true $global:nativeArguments[4].EndsWith('.log')
        Assert-Argv @('/S', '/Y') $global:nativeArguments[5..6]
    }
    else { Assert-Argv $Expected $global:nativeArguments }
}

$baseArguments = @('/Source:https://storage.invalid/files', "/Dest:C:\Bob's Files\", '/SourceSAS:sig=secret&sp=r')
foreach ($flag in @($null, $false))
{
    $global:hardeningRollback = $flag
    Assert-RemoteArguments @{ enableDetailedLogging = $true; cleanTargetBeforeCopy = $true } $baseArguments $true
    Assert-RemoteArguments @{ additionalArguments = '   ' } $baseArguments
    $options = '/Pattern:"Bob''s Files\*.txt" /Z:"C:\Journal Files\" /S'
    Assert-RemoteArguments @{ additionalArguments = $options } ($baseArguments + @("/Pattern:Bob's Files\*.txt", '/Z:C:\Journal Files\', '/S'))
    # Test quoted values without depending on unrelated doubled-quote parser/native marshalling changes.
    Assert-RemoteArguments @{ additionalArguments = '/Pattern:"a b c" /Empty:"" /Other:''a b''' } ($baseArguments + @('/Pattern:a b c', '/Empty:', '/Other:a b'))
    $inert = 'x$($global:injectionOccurred=$true);|#`'
    Assert-RemoteArguments @{
        targetPath = $inert; containerName = $inert; containerSasToken = $inert
        additionalArguments = '/Pattern:"$($global:injectionOccurred = $true)" ; | # $HOME'
    } (@("/Source:https://storage.invalid/$inert", "/Dest:$inert", "/SourceSAS:$inert") +
        @('/Pattern:$($global:injectionOccurred = $true)', ';', '|', '#', '$HOME'))
}
foreach ($codepoint in @(0x27, 0x2018, 0x2019, 0x201A, 0x201B))
{
    $value = 'C:\Bob' + [char]$codepoint + 's Files\'
    Assert-RemoteArguments @{
        targetPath = $value; containerName = $value; containerSasToken = $value
        additionalArguments = ('/Pattern:"' + $value + '"')
    } @("/Source:https://storage.invalid/$value", "/Dest:$value", "/SourceSAS:$value", "/Pattern:$value")
}

$oldSet = [Environment]::GetEnvironmentVariable('AFC_TARGET_TEST_SET')
$oldNested = [Environment]::GetEnvironmentVariable('AFC_TARGET_TEST_NESTED')
$oldMissing = [Environment]::GetEnvironmentVariable('AFC_TARGET_TEST_MISSING')
try
{
    $env:AFC_TARGET_TEST_SET = 'Value With Space'
    $env:AFC_TARGET_TEST_NESTED = '$env:AFC_TARGET_TEST_SET$($global:injectionOccurred=$true)'
    [Environment]::SetEnvironmentVariable('AFC_TARGET_TEST_MISSING', $null)
    $target = '$Env:AFC_TARGET_TEST_SET\${ENV:AFC_TARGET_TEST_MISSING}\$env:AFC_TARGET_TEST_NESTED'
    $expectedTarget = 'Value With Space\\$env:AFC_TARGET_TEST_SET$($global:injectionOccurred=$true)'
    Assert-RemoteArguments @{
        targetPath = $target
        additionalArguments = '/A:${Env:AFC_TARGET_TEST_SET} /B:$ENV:AFC_TARGET_TEST_NESTED /C:$env:AFC_TARGET_TEST_MISSING'
    } @($baseArguments[0], "/Dest:$expectedTarget", $baseArguments[2], '/A:Value With Space',
        '/B:$env:AFC_TARGET_TEST_SET$($global:injectionOccurred=$true)', '/C:')

    foreach ($rollback in @($false, $true))
    {
        $global:hardeningRollback = $rollback
        foreach ($sourceHardening in @($false, $true))
        {
            foreach ($sanitizer in @($false, $true))
            {
                $expectedTarget = '$env:AFC_TARGET_TEST_SET\deploy'
                if (!$sourceHardening -and !$sanitizer) { $expectedTarget = 'Value With Space\deploy' }
                Assert-RemoteArguments @{
                    targetPath = '$env:AFC_TARGET_TEST_SET\deploy'; additionalArguments = '/S'
                    useSourcePathHardening = $sourceHardening; useSanitizerActivate = $sanitizer
                } @($baseArguments[0], "/Dest:$expectedTarget", $baseArguments[2], '/S')
            }
        }
    }
}
finally
{
    [Environment]::SetEnvironmentVariable('AFC_TARGET_TEST_SET', $oldSet)
    [Environment]::SetEnvironmentVariable('AFC_TARGET_TEST_NESTED', $oldNested)
    [Environment]::SetEnvironmentVariable('AFC_TARGET_TEST_MISSING', $oldMissing)
}

# Legacy rollback serialization is inspected without executing it.
$global:hardeningRollback = $true
$job = Get-GeneratedRemoteJob @{ targetPath = "C:\Bob's"; additionalArguments = "/Pattern:'a b'" }
Assert-AreEqual " -containerURL 'https://storage.invalid/files' -targetPath 'C:\Bob's' -containerSasToken 'sig=secret&sp=r' -additionalArguments '/Pattern:'a b'' -azCopyToolFileNamesString 'AzCopy.exe' -azCopyToolFileContentsString '$toolContents' -disableTargetPathHardening" $job.scriptArguments
Assert-AreEqual $true $job.inlineScript.Contains('# Split-AdditionalArguments-Placeholder')

# Cleanup still runs when the native copy fails.
$global:failNativeCopy = $true
$caught = $false
try { Assert-RemoteArguments @{ targetPath = 'C:\deploy'; additionalArguments = '/S' } @() }
catch { $caught = $true; Assert-AreEqual 'Mock native copy failed' $_.Exception.Message }
finally { $global:failNativeCopy = $false }
Assert-AreEqual $true $caught
Assert-AreEqual $true ($global:cleanupCalls -ge 3)

Microsoft.PowerShell.Management\Remove-Item -Path function:Split-AdditionalArguments
# Rollback without SourcePath parsing needs no parser, even with the older sanitizer.
foreach ($sanitizer in @($false, $true))
{
    Get-GeneratedRemoteJob @{ useSanitizerActivate = $sanitizer } | Out-Null
}
foreach ($case in @(@{ Rollback = $false; Source = $false }, @{ Rollback = $true; Source = $true }))
{
    $global:hardeningRollback = $case.Rollback
    $caught = $false
    try { Get-GeneratedRemoteJob @{ useSourcePathHardening = $case.Source } | Out-Null }
    catch
    {
        $caught = $true
        Assert-AreEqual 'Split-AdditionalArguments function was not found. Ensure the Sanitizer module is imported.' $_.Exception.Message
    }
    Assert-AreEqual $true $caught 'Missing parser must fail explicitly'
}
}
finally
{
    Restore-TargetPathHardeningTestState
}
}
