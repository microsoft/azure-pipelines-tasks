Param(
    [string]$zipName,
    [string]$script,
    [string]$scriptArgs,
    [string]$prefixPath,
    [switch]$validateArgs
)

$ErrorActionPreference = 'Stop'

$cwd = (Get-Location).Path
$filesPath = Join-Path $cwd $prefixPath

if ($zipName) {
    $zipPath = Join-Path $filesPath $zipName
    $filesPath = Join-Path $filesPath 'a'
    Write-Host "Unzipping $zipPath"
    try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $filesPath)
}

Push-Location $filesPath

$invocation = "$script $scriptArgs"
if ($validateArgs) {
    # Check the exact decoded command with the same parser that will evaluate it.
    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($invocation, [ref]$tokens, [ref]$parseErrors)
    $validationError = 'Custom script arguments must contain only literal values.'
    if ($parseErrors.Count -gt 0 -or -not $ast.EndBlock -or $ast.EndBlock.Statements.Count -ne 1) {
        throw $validationError
    }
    $pipeline = $ast.EndBlock.Statements[0] -as [System.Management.Automation.Language.PipelineAst]
    if (-not $pipeline -or $pipeline.PipelineElements.Count -ne 1 -or
        $pipeline.PipelineElements[0] -isnot [System.Management.Automation.Language.CommandAst]) {
        throw $validationError
    }
    $command = $pipeline.PipelineElements[0]
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
            return $node -ne $command -or $node.InvocationOperator -ne [System.Management.Automation.Language.TokenKind]::Unknown
        }
        if ($node -is [System.Management.Automation.Language.PipelineAst]) {
            $background = $node.PSObject.Properties['Background']
            return $background -and $background.Value
        }
        if ($node -is [System.Management.Automation.Language.VariableExpressionAst]) {
            return $node.Splatted -or $node.VariablePath.UserPath -notin @('true', 'false')
        }
        if ($node -is [System.Management.Automation.Language.StringConstantExpressionAst] -and
            $node.StringConstantType -eq [System.Management.Automation.Language.StringConstantType]::BareWord -and
            $node.Value -eq '--%') {
            return $true
        }
        return $node.GetType().Name -notin $literalNodeTypes
    }, $true)
    if ($unsafeNodes.Count -gt 0) {
        throw $validationError
    }
}

Write-Host "Invoking command: $invocation"
Invoke-Expression $invocation