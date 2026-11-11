[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\RoboCopyJob.ps1

$testFunctionNames = @('Import-Module', 'Test-Path', 'Get-LocalizedString', 'net', 'robocopy', 'Invoke-Expression')
$previousTestFunctions = @{}
foreach($testFunctionName in $testFunctionNames)
{
    $previousTestFunction = Get-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
    if ($previousTestFunction)
    {
        $previousTestFunctions[$testFunctionName] = $previousTestFunction.ScriptBlock
    }
}

$global:netInvocations = New-Object System.Collections.Generic.List[object]
$global:invokeExpressionCommands = New-Object System.Collections.Generic.List[string]
$global:injected = $false

try
{
    function global:Import-Module { param([string]$Name) }
    function global:Get-LocalizedString { param([string]$Key) return $Key }
    function global:Test-Path {
        param([string]$Path, [string]$LiteralPath, [string]$PathType)

        if ($Path -match 'net\.exe$')
        {
            return $false
        }
        if ($Path -match 'Agent\\Worker|externals\\vstshost')
        {
            return $false
        }
        if ($PathType -eq 'Leaf')
        {
            return $true
        }

        return $false
    }
    function global:net {
        $global:netInvocations.Add(@($args))
        $global:LASTEXITCODE = 0
    }
    function global:robocopy {
        $global:LASTEXITCODE = 0
    }
    function global:Invoke-Expression {
        param([string]$Command)

        $global:invokeExpressionCommands.Add($Command)
        Microsoft.PowerShell.Utility\Invoke-Expression $Command
    }

    $maliciousUserName = 'poc"; $global:injected = $true; #'
    $credential = [PSCustomObject]@{ UserName = $maliciousUserName; Password = 'DummyPassword1!' }

    $global:injected = $false
    $global:netInvocations.Clear()
    $global:invokeExpressionCommands.Clear()

    $CopyJob.Invoke(
        '',
        'C:\source\poc-source.txt',
        '\\FAKEHOST\share$\dest',
        $credential,
        'false',
        '',
        'false',
        $false,
        $PSScriptRoot,
        $false
    )

    Assert-AreEqual $false $global:injected
    Assert-AreEqual 2 $global:netInvocations.Count

    $netUseArgs = $global:netInvocations[0]
    Assert-AreEqual $true ($netUseArgs -contains 'use')
    Assert-AreEqual $true ($netUseArgs -contains '\\FAKEHOST\share$\dest')
    Assert-AreEqual $true ($netUseArgs -contains "/user:$maliciousUserName")
    Assert-AreEqual $true ($netUseArgs -contains 'DummyPassword1!')

    foreach($command in $global:invokeExpressionCommands)
    {
        Assert-AreEqual $false ($command -match '/user:')
    }

    $global:injected = $false
    $global:netInvocations.Clear()
    $global:invokeExpressionCommands.Clear()

    $CopyJob.Invoke(
        '',
        'C:\source\poc-source.txt',
        '\\FAKEHOST\share$\dest',
        $credential,
        'false',
        '',
        'false',
        $false,
        $PSScriptRoot,
        $true
    )

    Assert-AreEqual $true $global:injected
    Assert-AreEqual $true ($global:invokeExpressionCommands.Count -gt 0)
    Assert-AreEqual $true ($global:invokeExpressionCommands[0] -match '/user:')
}
finally
{
    foreach($testFunctionName in $testFunctionNames)
    {
        if ($previousTestFunctions.ContainsKey($testFunctionName))
        {
            Set-Item -Path "function:\global:$testFunctionName" -Value $previousTestFunctions[$testFunctionName]
        }
        else
        {
            Microsoft.PowerShell.Management\Remove-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
        }
    }

    Remove-Variable -Name netInvocations -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name invokeExpressionCommands -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name injected -Scope Global -ErrorAction SilentlyContinue
}

