[CmdletBinding()]
param()

# Regression test for the legacy (feature flags off) branch of AzureFileCopyRemoteJob.ps1,
# the one that runs when neither -useSourcePathHardening nor -useSanitizerActivate is set.
#
# That branch used to build a command string with TargetPath, ContainerURL and the additional
# arguments pasted into it and then run it with Invoke-Expression. Even though the values reach the
# remote job safely as data (single-quoted, escaped in Copy-FilesToAzureVMsFromStorageContainer),
# that second evaluation re-parsed them as PowerShell, so a TargetPath such as C:\x$(...)y, or an
# additional argument such as --x $(...), executed the sub-expression on the target VM. Now the
# additional arguments are split by Split-AdditionalArguments (a parser that evaluates nothing) and
# azcopy is called with the resulting list, so every value is handed to azcopy as data.
#
# The documented behavior has to keep working: the TargetPath help says "Environment variable
# can be used like $env:windir\BudgetIT\Web". Only $env:NAME and ${env:NAME} are expanded, in the
# path and in each additional argument, and nothing else is evaluated. Other variables (for example
# $HOME or $PWD) used to be expanded as a side effect of Invoke-Expression; they are not documented
# and are now kept as literal text, which some scenarios pin down on purpose. The same goes for
# PowerShell syntax inside the additional arguments (;, |, #, backtick escapes), which is plain text.
#
# Three groups of scenarios are driven end to end (the generated scriptArguments text is executed
# exactly as RunPowerShellScriptJob.ps1 does on the target VM, with a fake azcopy capturing argv):
#   - behavior that must not change: a plain path, $env: expansion, quoted option values;
#   - hardening: a TargetPath or container name that carries $(...), a double quote, a backtick or
#     a typographic quote must reach azcopy as literal text, and must not run anything;
#   - additional arguments: quoted values stay one argument, and PowerShell syntax in them is not run.
#
# Typographic quotes are built from their code point on purpose: the repository files are BOM-less,
# and Windows PowerShell 5.1 would read a literal non-ASCII character using the ANSI code page.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1
. $PSScriptRoot\MockHelper.ps1

$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock Get-ChildItem { }
Register-Mock ConvertTo-SecureString { return $securedMockPassword }

# Capture the raw arguments passed to Copy-FilesSequentiallyToAzureVMs so the real
# $remoteScriptJobArguments hashtable can be inspected and then actually executed below.
Register-Mock Copy-FilesSequentiallyToAzureVMs { $global:capturedRemoteScriptJobArgs = $args }
Register-Mock Copy-FilesParallellyToAzureVMs { }

$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

# Fake the remote 'azcopy' command (PowerShell resolves a function ahead of an external
# application of the same name) to capture the argv that actually reaches it.
$global:capturedAzCopyArgs = $null
function global:azcopy
{
    if ($args.Count -gt 0 -and $args[0] -eq '--version')
    {
        return "azcopy version 10.25.1"
    }
    $global:capturedAzCopyArgs = $args
}

function Format-Argv
{
    param($Argv)
    return ((@($Argv) | ForEach-Object { "[$_]" }) -join ' ')
}

# Runs one scenario with both hardening flags off and asserts that azcopy received the expected arguments.
function Assert-LegacyScenario
{
    param(
        [hashtable]$Scenario
    )

    $containerName = $validInputContainerName
    if ($Scenario.ContainsKey('ContainerName'))
    {
        $containerName = $Scenario.ContainerName
    }
    $additionalArguments = ""
    if ($Scenario.ContainsKey('AdditionalArguments'))
    {
        $additionalArguments = $Scenario.AdditionalArguments
    }
    $trailingArguments = @('--recursive', '--log-level=INFO')
    if ($Scenario.ContainsKey('TrailingArguments'))
    {
        $trailingArguments = $Scenario.TrailingArguments
    }

    $global:injectionOccurred = $false
    $global:capturedAzCopyArgs = $null
    $global:capturedRemoteScriptJobArgs = $null

    Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                             -protocol $invokeRemoteScriptParams.protocol `
                                             -sessionOption $invokeRemoteScriptParams.sessionOption `
                                             -blobStorageEndpoint $validBlobStorageEndpoint `
                                             -containerName $containerName `
                                             -targetPath $Scenario.TargetPath `
                                             -cleanTargetBeforeCopy $false `
                                             -copyFilesInParallel $false `
                                             -additionalArguments $additionalArguments `
                                             -azCopyToolLocation "AzCopy" `
                                             -fileCopyJobScript $AzureFileCopyRemoteJob `
                                             -enableDetailedLogging $false `
                                             -useSanitizerActivate $false `
                                             -useSourcePathHardening $false

    Assert-IsNotNullOrEmpty $global:capturedRemoteScriptJobArgs "[$($Scenario.Name)] Expected Copy-FilesSequentiallyToAzureVMs to have been called."
    $remoteScriptJobArgumentsIndex = [array]::IndexOf($global:capturedRemoteScriptJobArgs, '-remoteScriptJobArguments')
    Assert-AreNotEqual -1 $remoteScriptJobArgumentsIndex "[$($Scenario.Name)] Expected -remoteScriptJobArguments to have been passed to Copy-FilesSequentiallyToAzureVMs."
    $remoteScriptJobArguments = $global:capturedRemoteScriptJobArgs[$remoteScriptJobArgumentsIndex + 1]

    # Exactly how RunPowerShellScriptJob.ps1 invokes the inline script on the target VM.
    $remoteJobScriptBlock = [scriptblock]::Create($remoteScriptJobArguments.inlineScript)
    $invokeCommandText = "& `$remoteJobScriptBlock $($remoteScriptJobArguments.scriptArguments.Trim())"
    Invoke-Expression $invokeCommandText

    Assert-AreEqual $false $global:injectionOccurred "[$($Scenario.Name)] Nothing inside TargetPath/ContainerURL may be evaluated as PowerShell."

    $expectedArgv = @('copy', "$validBlobStorageEndpoint/$containerName/*", $Scenario.ExpectedTargetPath) + @($trailingArguments)
    Assert-AreEqual (Format-Argv $expectedArgv) (Format-Argv $global:capturedAzCopyArgs) "[$($Scenario.Name)] azcopy must receive exactly these arguments."
}

$quote = [string][char]0x2019

# Environment variables used by the $env: scenarios. The second one is guaranteed to be unset.
$env:AFC_LEGACY_TEST_SET = 'Value With Space'
$env:AFC_LEGACY_TEST_EVIL = '$($global:injectionOccurred = $true)'
Remove-Item -Path Env:\AFC_LEGACY_TEST_UNSET -ErrorAction SilentlyContinue

$scenarios = @(
    # ---- behavior that must not change ----
    @{ Name = 'plain path containing an apostrophe'
       TargetPath = "C:\Users\Bob's Files\deploy"
       ExpectedTargetPath = "C:\Users\Bob's Files\deploy" },
    @{ Name = 'documented $env:windir expansion'
       TargetPath = '$env:windir\BudgetIT\Web'
       ExpectedTargetPath = "$env:windir\BudgetIT\Web" },
    @{ Name = 'env variable in braces and with a space in its value'
       TargetPath = 'C:\a\${env:AFC_LEGACY_TEST_SET}\b'
       ExpectedTargetPath = 'C:\a\Value With Space\b' },
    @{ Name = 'env variable without braces'
       TargetPath = 'C:\a\$env:AFC_LEGACY_TEST_SET\b'
       ExpectedTargetPath = 'C:\a\Value With Space\b' },
    # The "env:" keyword is matched case-insensitively, the same as PowerShell's own variable
    # provider syntax ($env:, $Env:, $ENV: are all equivalent).
    @{ Name = 'mixed-case $Env:NAME without braces is expanded'
       TargetPath = 'C:\a\$Env:AFC_LEGACY_TEST_SET\b'
       ExpectedTargetPath = 'C:\a\Value With Space\b' },
    @{ Name = 'upper-case $ENV:NAME without braces is expanded'
       TargetPath = 'C:\a\$ENV:AFC_LEGACY_TEST_SET\b'
       ExpectedTargetPath = 'C:\a\Value With Space\b' },
    @{ Name = 'mixed-case ${Env:NAME} in braces is expanded'
       TargetPath = 'C:\a\${Env:AFC_LEGACY_TEST_SET}\b'
       ExpectedTargetPath = 'C:\a\Value With Space\b' },
    @{ Name = 'upper-case ${ENV:NAME} in braces is expanded'
       TargetPath = 'C:\a\${ENV:AFC_LEGACY_TEST_SET}\b'
       ExpectedTargetPath = 'C:\a\Value With Space\b' },
    @{ Name = 'unset env variable expands to an empty string'
       TargetPath = 'C:\a\$env:AFC_LEGACY_TEST_UNSET\b'
       ExpectedTargetPath = 'C:\a\\b' },
    @{ Name = 'quoted additional arguments are still parsed as before'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--include-pattern "*.txt" --recursive'
       TrailingArguments = @('--include-pattern', '*.txt', '--recursive') },

    # ---- intentional behavior change: only $env:NAME / ${env:NAME} are expanded ----
    # Variables other than $env: used to be expanded by accident (they are not documented). They are
    # now kept as literal text; $env:USERPROFILE is the documented way to reach the home folder.
    @{ Name = 'non-env variable $HOME is not expanded'
       TargetPath = '$HOME\deploy'
       ExpectedTargetPath = '$HOME\deploy' },
    @{ Name = 'non-env variable ${HOME} in braces is not expanded'
       TargetPath = '${HOME}\deploy'
       ExpectedTargetPath = '${HOME}\deploy' },
    @{ Name = 'non-env variable $PWD is not expanded'
       TargetPath = '$PWD\deploy'
       ExpectedTargetPath = '$PWD\deploy' },
    @{ Name = 'documented replacement $env:USERPROFILE is expanded'
       TargetPath = '$env:USERPROFILE\deploy'
       ExpectedTargetPath = "$env:USERPROFILE\deploy" },

    # ---- hardening: these values must reach azcopy as literal text ----
    @{ Name = 'sub-expression in TargetPath is not evaluated'
       TargetPath = 'C:\x$($global:injectionOccurred = $true)y'
       ExpectedTargetPath = 'C:\x$($global:injectionOccurred = $true)y' },
    @{ Name = 'double quote and backtick in TargetPath'
       TargetPath = 'C:\a"b`c'
       ExpectedTargetPath = 'C:\a"b`c' },
    @{ Name = 'typographic quote break-out combined with a sub-expression'
       TargetPath = ("C:\Temp" + $quote + '; $global:injectionOccurred = $true; # $($global:injectionOccurred = $true)')
       ExpectedTargetPath = ("C:\Temp" + $quote + '; $global:injectionOccurred = $true; # $($global:injectionOccurred = $true)') },
    @{ Name = 'sub-expression in the container name is not evaluated'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       ContainerName = 'c$($global:injectionOccurred = $true)' },

    # ---- additional arguments: AzCopy options keep working, PowerShell syntax in them does not ----
    # The value is split into arguments by a parser that does not evaluate anything (quotes group
    # words, nothing else has a meaning); the resulting list is handed to azcopy as data.
    @{ Name = 'double-quoted option value with a space stays one argument'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--include-pattern "My Files\*.txt"'
       TrailingArguments = @('--include-pattern', 'My Files\*.txt') },
    @{ Name = 'semicolon inside a quoted pattern stays inside the argument'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--include-pattern "*.txt;*.js" --recursive'
       TrailingArguments = @('--include-pattern', '*.txt;*.js', '--recursive') },
    @{ Name = 'single-quoted option value with a space stays one argument'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = "--exclude-pattern 'a b'"
       TrailingArguments = @('--exclude-pattern', 'a b') },
    @{ Name = 'option with an equals sign and a quoted value'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--metadata="k=v w" --recursive'
       TrailingArguments = @('--metadata=k=v w', '--recursive') },
    @{ Name = '$env:NAME in additional arguments is expanded and stays one argument'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--include-path $env:AFC_LEGACY_TEST_SET --recursive'
       TrailingArguments = @('--include-path', 'Value With Space', '--recursive') },
    @{ Name = 'mixed-case $Env:NAME in additional arguments is expanded'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--include-path $Env:AFC_LEGACY_TEST_SET --recursive'
       TrailingArguments = @('--include-path', 'Value With Space', '--recursive') },
    @{ Name = 'upper-case ${ENV:NAME} in additional arguments is expanded'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--include-path ${ENV:AFC_LEGACY_TEST_SET} --recursive'
       TrailingArguments = @('--include-path', 'Value With Space', '--recursive') },
    @{ Name = '${env:NAME} and $env:NAME inside double quotes are expanded'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--a ${env:AFC_LEGACY_TEST_SET} --b "$env:AFC_LEGACY_TEST_SET\sub"'
       TrailingArguments = @('--a', 'Value With Space', '--b', 'Value With Space\sub') },
    @{ Name = 'the value of an environment variable is not evaluated again'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--x $env:AFC_LEGACY_TEST_EVIL'
       TrailingArguments = @('--x', '$($global:injectionOccurred = $true)') },
    @{ Name = 'non-env variable $HOME in additional arguments is not expanded'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--x $HOME'
       TrailingArguments = @('--x', '$HOME') },
    @{ Name = 'sub-expression in additional arguments is not evaluated'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--x $($global:injectionOccurred=$true)'
       TrailingArguments = @('--x', '$($global:injectionOccurred=$true)') },
    @{ Name = 'sub-expression inside double quotes in additional arguments is not evaluated'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--x "$($global:injectionOccurred = $true)"'
       TrailingArguments = @('--x', '$($global:injectionOccurred = $true)') },
    @{ Name = 'statement separator in additional arguments does not start a new statement'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--x; $global:injectionOccurred=$true'
       TrailingArguments = @('--x;', '$global:injectionOccurred=$true') },
    @{ Name = 'pipe and comment characters in additional arguments are plain text'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = '--a | --b # --c'
       TrailingArguments = @('--a', '|', '--b', '#', '--c') },
    @{ Name = 'typographic quote in additional arguments is plain text'
       TargetPath = 'C:\Temp\files'
       ExpectedTargetPath = 'C:\Temp\files'
       AdditionalArguments = ('--exclude-pattern Bob' + $quote + 's')
       TrailingArguments = @('--exclude-pattern', ('Bob' + $quote + 's')) }
)

try
{
    foreach ($scenario in $scenarios)
    {
        Assert-LegacyScenario -Scenario $scenario
    }
}
finally
{
    Remove-Item -Path function:global:azcopy -ErrorAction SilentlyContinue
    Remove-Item -Path Env:\AFC_LEGACY_TEST_SET -ErrorAction SilentlyContinue
    Remove-Item -Path Env:\AFC_LEGACY_TEST_EVIL -ErrorAction SilentlyContinue
}
