[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\.."

# 1. The agent-side defence in depth must stay in both task definitions: the task logs only through the
#    task SDK, never needs to set a variable and never needs to emit anything but issues and progress.
foreach ($definitionName in 'task.json', 'task.loc.json')
{
    $definition = Get-Content -LiteralPath "$taskPath\$definitionName" -Raw | ConvertFrom-Json
    Assert-AreEqual 'restricted' $definition.restrictions.commands.mode "$definitionName must restrict logging commands."
    Assert-AreEqual $true ($definition.restrictions.settableVariables.PSObject.Properties.Name -contains 'allowed') "$definitionName must declare settableVariables.allowed."
    Assert-AreEqual 0 @($definition.restrictions.settableVariables.allowed).Count "$definitionName must not allow the task to set any variable."
}

# 2. Every line the task writes to the host must be exactly one Protect-ExternalOutput result, which is also what
#    the behavioral tests capture. Other ways to write to the host are not used and must not appear. The download
#    progress line only formats a byte count, so it is the one intentional exception.
$productFiles = @(Get-ChildItem -LiteralPath $taskPath -File | Where-Object { $_.Extension -eq '.ps1' -or $_.Extension -eq '.psm1' })
Assert-IsNotNullOrEmpty $productFiles "No product scripts were found, the check would be meaningless."

$otherHostOutput = 'Write-Output', 'write', 'Write-Information', 'Out-Host', 'Out-Default', 'echo'
$violations = @()
$writeHostCount = 0

# Module-qualified invocations (e.g. 'Microsoft.PowerShell.Utility\Write-Host') and dot-sourced-qualified names must
# still be recognized as the same command; GetCommandName() returns the qualified text as written.
function Get-UnqualifiedCommandName([string] $Name)
{
    $lastSeparator = $Name.LastIndexOf('\')
    if ($lastSeparator -ge 0) { return $Name.Substring($lastSeparator + 1) }
    return $Name
}

# The one allowed exception (download byte-count progress, no untrusted text) is matched by AST, not by a text search
# over the whole call - a text search would also exempt an unrelated future call whose source happens to mention this key.
function Test-IsDownloadingArtifactProgressCall($command)
{
    $nestedLocStringCalls = $command.FindAll({ param($node) ($node -is [System.Management.Automation.Language.CommandAst]) -and ((Get-UnqualifiedCommandName $node.GetCommandName()) -eq 'Get-VstsLocString') }, $true)
    foreach ($nested in $nestedLocStringCalls)
    {
        $keyParam = $nested.CommandElements | Where-Object { $_.ParameterName -eq 'Key' } | Select-Object -First 1
        if (-not $keyParam) { continue }
        $keyIndex = $nested.CommandElements.IndexOf($keyParam)
        if ($keyIndex + 1 -ge $nested.CommandElements.Count) { continue }
        $keyValue = $nested.CommandElements[$keyIndex + 1].Extent.Text.Trim("'", '"')
        if ($keyValue -eq 'DownloadingArtifactProgress') { return $true }
    }
    return $false
}

foreach ($file in $productFiles)
{
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$null, [ref]$parseErrors)
    Assert-AreEqual 0 @($parseErrors).Count "$($file.Name) has parse errors."

    $commands = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true)
    foreach ($command in $commands)
    {
        $name = Get-UnqualifiedCommandName $command.GetCommandName()
        if (-not $name)
        {
            continue
        }

        if ($name -eq 'Write-Host')
        {
            $writeHostCount++
            if (Test-IsDownloadingArtifactProgressCall $command)
            {
                continue
            }

            $arguments = @($command.CommandElements | Select-Object -Skip 1)
            $isProtected = $false
            if ($arguments.Count -eq 1 -and $arguments[0] -is [System.Management.Automation.Language.ParenExpressionAst])
            {
                $inner = $arguments[0].Pipeline
                $isProtected = ($inner -is [System.Management.Automation.Language.PipelineAst]) -and
                    ($inner.PipelineElements.Count -eq 1) -and
                    ($inner.PipelineElements[0] -is [System.Management.Automation.Language.CommandAst]) -and
                    ((Get-UnqualifiedCommandName $inner.PipelineElements[0].GetCommandName()) -eq 'Protect-ExternalOutput')
            }

            if (-not $isProtected)
            {
                $violations += "$($file.Name):$($command.Extent.StartLineNumber): $($command.Extent.Text)"
            }
        }
        elseif ($otherHostOutput -contains $name)
        {
            $violations += "$($file.Name):$($command.Extent.StartLineNumber): $($command.Extent.Text)"
        }
    }

    $consoleTypes = $ast.FindAll({ param($node) ($node -is [System.Management.Automation.Language.TypeExpressionAst]) -and ($node.TypeName.Name -match '^(System\.)?Console$') }, $true)
    foreach ($consoleType in $consoleTypes)
    {
        $violations += "$($file.Name):$($consoleType.Extent.StartLineNumber): $($consoleType.Extent.Text)"
    }
}

Assert-AreEqual $true ($writeHostCount -gt 0) "No Write-Host calls were found, the check would be meaningless."
Assert-AreEqual 0 $violations.Count "Every Write-Host must pass exactly one Protect-ExternalOutput result and no other host output is allowed. Violations: $($violations -join ' | ')"

# 3. Two values do not reach the host through Write-Host: Assert-ValidManifestPathSegment's thrown message (shared by
#    Update-ServiceVersions.psm1, Update-PackageVersion.psm1 and Update-DockerImageSettings.psm1) and the
#    CouldNotFindSubPath warning in Update-ApplicationVersions.psm1. Both carry repository-controlled text (a manifest
#    path segment name; the resolved package path) and reach the host only through the task SDK's own
#    Write-Warning/exception reporting, which is not encoding-aware (see Protect-ExternalOutput's own comment). Every
#    -ArgumentList value of these two specific Get-VstsLocString keys must be protected; this is a targeted check of
#    these known sinks, not a general rule for every throw/Write-Warning in the task (several others carry service- or
#    input-derived text that is out of the repository-contributor threat model and are intentionally left as-is).
$knownIndirectSinkKeys = 'InvalidManifestPathSegment', 'CouldNotFindSubPath'
$indirectSinkFound = @{}
foreach ($key in $knownIndirectSinkKeys) { $indirectSinkFound[$key] = $false }

function Test-IsProtectExternalOutputElement($element)
{
    $inner = $element
    if ($inner -is [System.Management.Automation.Language.ParenExpressionAst]) { $inner = $inner.Pipeline }
    return ($inner -is [System.Management.Automation.Language.PipelineAst]) -and
        ($inner.PipelineElements.Count -ge 1) -and
        ($inner.PipelineElements[0] -is [System.Management.Automation.Language.CommandAst]) -and
        ((Get-UnqualifiedCommandName $inner.PipelineElements[0].GetCommandName()) -eq 'Protect-ExternalOutput')
}

function Get-ArrayLiteralElements($arrayExpressionOrLiteral)
{
    $value = $arrayExpressionOrLiteral
    if ($value -is [System.Management.Automation.Language.ArrayExpressionAst])
    {
        # @(...) parses as ArrayExpressionAst wrapping a statement block; unwrap to the single statement's expression.
        if ($value.SubExpression.Statements.Count -ne 1) { return @($value) }
        $value = $value.SubExpression.Statements[0].PipelineElements[0].Expression
    }
    if ($value -is [System.Management.Automation.Language.ArrayLiteralAst]) { return $value.Elements }
    return @($value)
}

foreach ($file in $productFiles)
{
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$null, [ref]$null)
    $locStringCalls = $ast.FindAll({ param($node) ($node -is [System.Management.Automation.Language.CommandAst]) -and ((Get-UnqualifiedCommandName $node.GetCommandName()) -eq 'Get-VstsLocString') }, $true)
    foreach ($call in $locStringCalls)
    {
        $keyIndex = $call.CommandElements.IndexOf(($call.CommandElements | Where-Object { $_.ParameterName -eq 'Key' } | Select-Object -First 1))
        if ($keyIndex -lt 0 -or $keyIndex + 1 -ge $call.CommandElements.Count) { continue }
        $keyValue = $call.CommandElements[$keyIndex + 1].Extent.Text.Trim("'", '"')
        if ($knownIndirectSinkKeys -notcontains $keyValue) { continue }

        $indirectSinkFound[$keyValue] = $true
        $argListElement = $call.CommandElements | Where-Object { $_.ParameterName -eq 'ArgumentList' } | Select-Object -First 1
        $argListIndex = $call.CommandElements.IndexOf($argListElement)
        $argListValue = $call.CommandElements[$argListIndex + 1]
        $arrayExpr = Get-ArrayLiteralElements $argListValue
        $anyProtected = @($arrayExpr | Where-Object { Test-IsProtectExternalOutputElement $_ }).Count -gt 0
        if (-not $anyProtected)
        {
            $violations += "$($file.Name):$($call.Extent.StartLineNumber): Get-VstsLocString -Key $keyValue must protect at least one -ArgumentList value: $($call.Extent.Text)"
        }
    }
}

foreach ($key in $knownIndirectSinkKeys)
{
    Assert-AreEqual $true $indirectSinkFound[$key] "Expected to find a Get-VstsLocString -Key $key call; this guard needs updating if the call site moved or was renamed."
}
Assert-AreEqual 0 $violations.Count "Known indirect sinks must protect their repository-controlled argument(s). Violations: $($violations -join ' | ')"
