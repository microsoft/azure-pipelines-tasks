[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\.."

# 1. The agent-side defence in depth must stay in both task definitions: the task never needs to set a variable and
#    emits nothing but issues, progress and telemetry, so the agent rejects every other logging command should the
#    sanitizing below ever regress.
foreach ($definitionName in 'task.json', 'task.loc.json')
{
    $definition = Get-Content -LiteralPath "$taskPath\$definitionName" -Raw | ConvertFrom-Json
    $restrictions = $definition.restrictions
    Assert-AreEqual 'restricted' $restrictions.commands.mode "$definitionName must restrict logging commands."
    Assert-AreEqual $true ($restrictions.settableVariables.PSObject.Properties.Name -contains 'allowed') `
        "$definitionName must declare settableVariables.allowed."
    Assert-AreEqual 0 @($restrictions.settableVariables.allowed).Count `
        "$definitionName must not allow the task to set any variable."
}

# 2. Text read back from the cluster must reach the host only through a blocking Protect-ExternalOutput call. The
#    behavioral tests prove that each known sink neutralizes a marker; this guards the call sites of the functions
#    below, including the refactorings that would silently bypass the sanitizer. It is a targeted check of the known
#    call sites, not a general rule for every message of the task.
function Get-UnqualifiedCommandName([string] $Name)
{
    $lastSeparator = $Name.LastIndexOf('\')
    if ($lastSeparator -ge 0) { return $Name.Substring($lastSeparator + 1) }
    return $Name
}

function Get-ParsedFile([string] $RelativePath)
{
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        "$taskPath\$RelativePath", [ref]$null, [ref]$parseErrors)
    Assert-AreEqual 0 @($parseErrors).Count "$RelativePath has parse errors."
    return $ast
}

function Get-FunctionAst($Ast, [string] $FunctionName)
{
    $function = $Ast.Find({
        param($node)
        ($node -is [System.Management.Automation.Language.FunctionDefinitionAst]) -and $node.Name -eq $FunctionName
    }, $true)
    Assert-IsNotNullOrEmpty $function `
        "Function $FunctionName was not found; this guard needs updating if it moved or was renamed."
    return $function
}

function Find-Commands($Ast, [scriptblock] $Predicate)
{
    return @($Ast.FindAll({
        param($node)
        ($node -is [System.Management.Automation.Language.CommandAst]) -and (& $Predicate $node)
    }, $true))
}

function Find-CommandsByName($Ast, [string[]] $Names)
{
    return @(Find-Commands $Ast {
        param($command)
        $Names -contains (Get-UnqualifiedCommandName $command.GetCommandName())
    })
}

# PowerShell accepts abbreviated parameter names, and the value may follow a colon.
function Test-IsParameter($Element, [string] $ParameterName)
{
    return ($Element -is [System.Management.Automation.Language.CommandParameterAst]) -and
        $ParameterName.StartsWith($Element.ParameterName, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-ParameterValue($Command, [string] $ParameterName)
{
    for ($i = 0; $i -lt $Command.CommandElements.Count; $i++)
    {
        $element = $Command.CommandElements[$i]
        if (-not (Test-IsParameter $element $ParameterName)) { continue }
        if ($element.Argument) { return $element.Argument }
        if ($i + 1 -lt $Command.CommandElements.Count) { return $Command.CommandElements[$i + 1] }
    }

    return $null
}

# Returns the Protect-ExternalOutput call a value consists of, unwrapping '(...)', otherwise $null.
function Get-ProtectExternalOutputCall($ValueAst)
{
    $inner = $ValueAst
    if ($inner -is [System.Management.Automation.Language.ParenExpressionAst]) { $inner = $inner.Pipeline }
    if (($inner -is [System.Management.Automation.Language.PipelineAst]) -and
        ($inner.PipelineElements.Count -eq 1) -and
        ($inner.PipelineElements[0] -is [System.Management.Automation.Language.CommandAst]) -and
        ((Get-UnqualifiedCommandName $inner.PipelineElements[0].GetCommandName()) -eq 'Protect-ExternalOutput'))
    {
        return $inner.PipelineElements[0]
    }

    return $null
}

# The mode may be left out, which blocks, but a value that cannot be seen to block (a variable, 'disabled') does not.
function Test-BlocksLoggingCommands($ProtectCall)
{
    if (-not ($ProtectCall.CommandElements | Where-Object { Test-IsParameter $_ 'VsoCommandMode' })) { return $true }

    $mode = Get-ParameterValue $ProtectCall 'VsoCommandMode'
    return ($mode -is [System.Management.Automation.Language.StringConstantExpressionAst]) -and
        ($mode.Value -in 'blockOnly', 'blockAndTelemetry')
}

function Test-IsBlockingProtectCall($ValueAst)
{
    $call = Get-ProtectExternalOutputCall $ValueAst
    return ($null -ne $call) -and (Test-BlocksLoggingCommands $call)
}

# A localized label without interpolated values: 'Get-VstsLocString -Key <name>' and nothing else.
function Test-IsFixedLabel($Element)
{
    if ($Element -is [System.Management.Automation.Language.StringConstantExpressionAst]) { return $true }

    $inner = $Element
    if ($inner -is [System.Management.Automation.Language.ParenExpressionAst]) { $inner = $inner.Pipeline }
    if (-not (($inner -is [System.Management.Automation.Language.PipelineAst]) -and
        ($inner.PipelineElements.Count -eq 1) -and
        ($inner.PipelineElements[0] -is [System.Management.Automation.Language.CommandAst])))
    {
        return $false
    }

    $call = $inner.PipelineElements[0]
    return ((Get-UnqualifiedCommandName $call.GetCommandName()) -eq 'Get-VstsLocString') -and
        ($call.CommandElements.Count -eq 3) -and
        (Test-IsParameter $call.CommandElements[1] 'Key')
}

$otherHostOutput = 'Write-Output', 'write', 'Write-Information', 'Out-Host', 'Out-Default', 'echo'
$violations = @()

# 2a. In these functions every Write-Host argument is a fixed label or a blocking Protect-ExternalOutput result, so a
#     raw value cannot be added next to a protected one. The health dumps are objects that the host would format
#     unfiltered if they were left in the success stream, so the cmdlet must be consumed by the sanitizer.
$utilities = Get-ParsedFile 'ServiceFabricSDK\Utilities.ps1'
$hostSinkFunctions = @(
    @{
        Name = 'Wait-ServiceFabricApplicationUpgradeAction'
        ProtectedWrites = 3
        Cmdlet = $null
    },
    @{
        Name = 'Trace-ServiceFabricClusterHealth'
        ProtectedWrites = 1
        Cmdlet = 'Get-ServiceFabricClusterHealth'
    },
    @{
        Name = 'Trace-ServiceFabricApplicationHealth'
        ProtectedWrites = 1
        Cmdlet = 'Get-ServiceFabricApplicationHealth'
    }
)

foreach ($sink in $hostSinkFunctions)
{
    $function = Get-FunctionAst $utilities $sink.Name
    $protectedWrites = 0

    foreach ($write in (Find-CommandsByName $function 'Write-Host'))
    {
        $arguments = @($write.CommandElements | Select-Object -Skip 1)
        if (@($arguments | Where-Object { Get-ProtectExternalOutputCall $_ }).Count -gt 0) { $protectedWrites++ }

        foreach ($argument in $arguments)
        {
            if (-not (Test-IsFixedLabel $argument) -and -not (Test-IsBlockingProtectCall $argument))
            {
                $violations += "Utilities.ps1:$($write.Extent.StartLineNumber): $($write.Extent.Text)"
            }
        }
    }

    Assert-AreEqual $sink.ProtectedWrites $protectedWrites (
        "Expected $($sink.ProtectedWrites) Write-Host call(s) with a Protect-ExternalOutput result in $($sink.Name); " +
        'this guard needs updating if the function changed.')

    foreach ($command in (Find-CommandsByName $function $otherHostOutput))
    {
        $violations += "Utilities.ps1:$($command.Extent.StartLineNumber): $($command.Extent.Text)"
    }

    $consoleTypes = $function.FindAll({
        param($node)
        ($node -is [System.Management.Automation.Language.TypeExpressionAst]) -and
            ($node.TypeName.Name -match '^(System\.)?Console$')
    }, $true)
    foreach ($consoleType in $consoleTypes)
    {
        $violations += "Utilities.ps1:$($consoleType.Extent.StartLineNumber): $($consoleType.Extent.Text)"
    }

    if (-not $sink.Cmdlet) { continue }

    $dumps = Find-CommandsByName $function $sink.Cmdlet
    Assert-AreEqual 1 $dumps.Count "Expected exactly one $($sink.Cmdlet) call in $($sink.Name)."

    $protectCall = $null
    for ($ancestor = $dumps[0].Parent; $ancestor -and -not $protectCall; $ancestor = $ancestor.Parent)
    {
        if (($ancestor -is [System.Management.Automation.Language.CommandAst]) -and
            (Get-UnqualifiedCommandName $ancestor.GetCommandName()) -eq 'Protect-ExternalOutput')
        {
            $protectCall = $ancestor
        }
    }

    if (-not $protectCall -or -not (Test-BlocksLoggingCommands $protectCall))
    {
        $violations += "Utilities.ps1:$($dumps[0].Extent.StartLineNumber): $($dumps[0].Extent.Text)"
    }
}

Assert-AreEqual 0 $violations.Count (
    'Text read back from the cluster must reach the host through a blocking Protect-ExternalOutput call. ' +
    "Violations: $($violations -join ' | ')")
