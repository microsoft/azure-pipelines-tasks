[CmdletBinding()]
param()

# Regression test for the -additionalArguments literal built by
# Copy-FilesToAzureVMsFromStorageContainer.
#
# The generated scriptArguments text carries AdditionalArguments inside a single-quoted literal
# (-additionalArguments '...'). Without escaping, a quote character inside the value ended that
# literal early. That broke legitimate values such as --include-pattern "Bob's Files\*" with a
# parse error, and it let a crafted value inject extra statements and comment out the switches
# that follow it (-useSanitizerActivate, -useSourcePathHardening). The value is now escaped with
# [System.Management.Automation.Language.CodeGeneration]::EscapeSingleQuotedStringContent, which
# doubles every character PowerShell accepts as a single-quote delimiter: the ASCII apostrophe
# and the typographic quotes U+2018, U+2019, U+201A and U+201B.
#
# Two kinds of checks, each run for every scenario:
#   - static: the generated scriptArguments text is parsed WITHOUT executing it. It must parse
#     cleanly, stay a single command, keep the hardening switch as a real parameter and bind the
#     original value to -additionalArguments;
#   - end to end (legacy path, feature flags off): a legitimate value containing a quote reaches
#     azcopy as the same arguments a value without a quote would produce.
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
# $remoteScriptJobArguments hashtable can be inspected (and, for the end to end checks, executed).
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

# Drives Copy-FilesToAzureVMsFromStorageContainer and returns the generated remote job arguments.
function Get-GeneratedRemoteJobArguments
{
    param(
        [string]$AdditionalArguments,
        [bool]$UseSourcePathHardening
    )

    $global:capturedRemoteScriptJobArgs = $null

    Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                             -protocol $invokeRemoteScriptParams.protocol `
                                             -sessionOption $invokeRemoteScriptParams.sessionOption `
                                             -blobStorageEndpoint $validBlobStorageEndpoint `
                                             -containerName $validInputContainerName `
                                             -targetPath 'C:\Temp\files' `
                                             -cleanTargetBeforeCopy $false `
                                             -copyFilesInParallel $false `
                                             -additionalArguments $AdditionalArguments `
                                             -azCopyToolLocation "AzCopy" `
                                             -fileCopyJobScript $AzureFileCopyRemoteJob `
                                             -enableDetailedLogging $false `
                                             -useSanitizerActivate $UseSourcePathHardening `
                                             -useSourcePathHardening $UseSourcePathHardening

    Assert-IsNotNullOrEmpty $global:capturedRemoteScriptJobArgs "Expected Copy-FilesSequentiallyToAzureVMs to have been called."
    $index = [array]::IndexOf($global:capturedRemoteScriptJobArgs, '-remoteScriptJobArguments')
    Assert-AreNotEqual -1 $index "Expected -remoteScriptJobArguments to have been passed to Copy-FilesSequentiallyToAzureVMs."
    return $global:capturedRemoteScriptJobArgs[$index + 1]
}

# Static check: parse the generated scriptArguments text without running it.
function Assert-AdditionalArgumentsStayLiteral
{
    param(
        [string]$Name,
        [string]$Value
    )

    $remoteScriptJobArguments = Get-GeneratedRemoteJobArguments -AdditionalArguments $Value -UseSourcePathHardening $true

    $tokens = $null
    $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput(". 'script.ps1' $($remoteScriptJobArguments.scriptArguments.Trim())", [ref]$tokens, [ref]$errors)

    Assert-AreEqual 0 $errors.Count "[static: $Name] The generated arguments must parse without errors."
    Assert-AreEqual 1 $ast.EndBlock.Statements.Count "[static: $Name] The generated arguments must stay a single command (a quote in the value must not end the literal)."

    $elements = @($ast.EndBlock.Statements[0].PipelineElements[0].CommandElements)
    $bound = $null
    $switchKept = $false
    for ($i = 0; $i -lt $elements.Count; $i++)
    {
        if ($elements[$i] -is [System.Management.Automation.Language.CommandParameterAst])
        {
            if ($elements[$i].ParameterName -eq 'additionalArguments' -and ($i + 1) -lt $elements.Count)
            {
                $bound = $elements[$i + 1].Value
            }
            if ($elements[$i].ParameterName -eq 'useSourcePathHardening')
            {
                $switchKept = $true
            }
        }
    }

    Assert-AreEqual $Value $bound "[static: $Name] -additionalArguments must be bound to the original value."
    Assert-AreEqual $true $switchKept "[static: $Name] -useSourcePathHardening must still be a real parameter, not commented out by the value."
}

# End to end check on the legacy path (both feature flags off): run the generated remote job
# the way the target VM does and compare what azcopy receives.
function Assert-LegacyArgv
{
    param(
        [string]$Name,
        [string]$Value,
        [string[]]$ExpectedTrailingArguments
    )

    $global:capturedAzCopyArgs = $null

    $remoteScriptJobArguments = Get-GeneratedRemoteJobArguments -AdditionalArguments $Value -UseSourcePathHardening $false

    $remoteJobScriptBlock = [scriptblock]::Create($remoteScriptJobArguments.inlineScript)
    $invokeCommandText = "& `$remoteJobScriptBlock $($remoteScriptJobArguments.scriptArguments.Trim())"
    Invoke-Expression $invokeCommandText

    $expectedArgv = @('copy', "$validBlobStorageEndpoint/$validInputContainerName/*", 'C:\Temp\files') + @($ExpectedTrailingArguments)
    Assert-AreEqual (Format-Argv $expectedArgv) (Format-Argv $global:capturedAzCopyArgs) "[end to end: $Name] azcopy must receive exactly these arguments."
}

$quoteCharacters = @(
    @{ Name = "ASCII apostrophe (U+0027)";                      Value = [string][char]0x0027 },
    @{ Name = "left single quotation mark (U+2018)";            Value = [string][char]0x2018 },
    @{ Name = "right single quotation mark (U+2019)";           Value = [string][char]0x2019 },
    @{ Name = "single low-9 quotation mark (U+201A)";           Value = [string][char]0x201A },
    @{ Name = "single high-reversed-9 quotation mark (U+201B)"; Value = [string][char]0x201B }
)

try
{
    # ---- static checks ----
    $staticScenarios = @(
        @{ Name = 'default arguments';        Value = '--recursive --log-level=INFO' },
        @{ Name = 'double-quoted argument';   Value = '--include-pattern "*.txt" --recursive' }
    )
    foreach ($quote in $quoteCharacters)
    {
        # A legitimate value that merely contains the character inside a double-quoted argument.
        $staticScenarios += @{ Name = "legitimate value containing $($quote.Name)"; Value = ('--include-pattern "Bob' + $quote.Value + 's Files\*" --recursive') }
        # A value crafted to end the literal with this character, inject a statement and
        # comment out the switches that follow.
        $staticScenarios += @{ Name = "break-out attempt using $($quote.Name)"; Value = ('--x' + $quote.Value + '; Write-Output INJECTED; #') }
    }

    foreach ($scenario in $staticScenarios)
    {
        Assert-AdditionalArgumentsStayLiteral -Name $scenario.Name -Value $scenario.Value
    }

    # ---- end to end checks (legacy path) ----
    $endToEndScenarios = @()
    foreach ($quote in $quoteCharacters)
    {
        $endToEndScenarios += @{
            Name = "legitimate value containing $($quote.Name)"
            Value = ('--include-pattern "Bob' + $quote.Value + 's Files\*" --recursive')
            Expected = @('--include-pattern', ('Bob' + $quote.Value + 's Files\*'), '--recursive')
        }
    }

    foreach ($scenario in $endToEndScenarios)
    {
        Assert-LegacyArgv -Name $scenario.Name -Value $scenario.Value -ExpectedTrailingArguments $scenario.Expected
    }
}
finally
{
    Remove-Item -Path function:global:azcopy -ErrorAction SilentlyContinue
}
