$ErrorActionPreference = 'Stop'
$payloadError = 'Invalid Windows custom script payload.'
$argumentError = 'Custom script arguments must contain only literal values.'
$payloadPath = Join-Path $PSScriptRoot 'vmssScriptArgs.json'
$payloadFile = Get-Item -LiteralPath $payloadPath
if ($payloadFile.Length -gt 1048576) {
    throw $payloadError
}
try {
    $encoding = New-Object System.Text.UTF8Encoding($false, $true)
    $payloadText = $encoding.GetString([System.IO.File]::ReadAllBytes($payloadPath))
    $payload = $payloadText | ConvertFrom-Json
} catch [System.Text.DecoderFallbackException], [System.ArgumentException], [System.InvalidOperationException] {
    throw $payloadError
}
$properties = @($payload.PSObject.Properties.Name)
if ($payload -isnot [PSCustomObject] -or $properties.Count -ne 4 -or
    @($properties | Where-Object { $_ -notin @('version', 'script', 'scriptArgs', 'archived') }).Count -gt 0 -or
    ($payload.version -isnot [int] -and $payload.version -isnot [long]) -or $payload.version -ne 1 -or
    $payload.script -isnot [string] -or [string]::IsNullOrWhiteSpace($payload.script) -or
    $payload.scriptArgs -isnot [string] -or $payload.archived -isnot [bool]) {
    throw $payloadError
}

$filesPath = Join-Path $PSScriptRoot 'scripts'
if ($payload.archived) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $PSScriptRoot 'scripts.zip'), $filesPath)
}
if ([System.IO.Path]::IsPathRooted($payload.script) -or $payload.script.Contains(':')) {
    throw 'The custom script must be a relative .ps1 file inside the script directory.'
}
$root = [System.IO.Path]::GetFullPath($filesPath).TrimEnd('\') + '\'
$__vmssTrustedScript = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $payload.script))
if (-not $__vmssTrustedScript.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not [System.IO.Path]::GetExtension($__vmssTrustedScript).Equals('.ps1', [System.StringComparison]::OrdinalIgnoreCase) -or
    -not [System.IO.File]::Exists($__vmssTrustedScript)) {
    throw 'The custom script must be a relative .ps1 file inside the script directory.'
}

# The script path is data in a bootstrap-owned variable, never interpolated as source.
$invocation = '& $__vmssTrustedScript ' + $payload.scriptArgs
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($invocation, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0 -or -not $ast.EndBlock -or $ast.EndBlock.Statements.Count -ne 1 -or
    $payload.scriptArgs -match '[\r\n]') {
    throw $argumentError
}
$pipeline = $ast.EndBlock.Statements[0] -as [System.Management.Automation.Language.PipelineAst]
if (-not $pipeline -or $pipeline.PipelineElements.Count -ne 1 -or
    $pipeline.PipelineElements[0] -isnot [System.Management.Automation.Language.CommandAst]) {
    throw $argumentError
}
$command = $pipeline.PipelineElements[0]
$scriptNode = $command.CommandElements[0]
if ($command.InvocationOperator -ne [System.Management.Automation.Language.TokenKind]::Ampersand -or
    $scriptNode -isnot [System.Management.Automation.Language.VariableExpressionAst] -or
    $scriptNode.VariablePath.UserPath -ne '__vmssTrustedScript') {
    throw $argumentError
}
$literalNodeTypes = @(
    'CommandExpressionAst', 'CommandParameterAst', 'ConstantExpressionAst',
    'StringConstantExpressionAst', 'ArrayLiteralAst', 'HashtableAst', 'StatementBlockAst'
)
$unsafeNodes = $ast.FindAll({
    param($node)
    if ($node -is [System.Management.Automation.Language.ScriptBlockAst]) {
        return $node -ne $ast
    }
    if ($node -is [System.Management.Automation.Language.NamedBlockAst]) {
        return $node -ne $ast.EndBlock
    }
    if ($node -is [System.Management.Automation.Language.CommandAst]) {
        return $node -ne $command
    }
    if ($node -is [System.Management.Automation.Language.PipelineAst]) {
        $background = $node.PSObject.Properties['Background']
        return $background -and $background.Value
    }
    if ($node -is [System.Management.Automation.Language.VariableExpressionAst]) {
        return $node -ne $scriptNode -and ($node.Splatted -or $node.VariablePath.UserPath -notin @('true', 'false', 'null'))
    }
    if ($node -is [System.Management.Automation.Language.StringConstantExpressionAst] -and
        $node.StringConstantType -eq [System.Management.Automation.Language.StringConstantType]::BareWord -and
        $node.Value -eq '--%') {
        return $true
    }
    return $node.GetType().Name -notin $literalNodeTypes
}, $true)
if ($unsafeNodes.Count -gt 0) {
    throw $argumentError
}

Push-Location -LiteralPath $filesPath
try {
    Write-Host 'Invoking custom script.'
    Invoke-Expression $invocation
    if ($LASTEXITCODE) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
