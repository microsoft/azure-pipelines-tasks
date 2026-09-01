[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$previousSanitizerSetting = [Environment]::GetEnvironmentVariable('AZP_75787_ENABLE_NEW_LOGIC', 'Process')
$previousHardeningSetting = [Environment]::GetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', 'Process')
$testFunctionNames = @('Get-VstsPipelineFeature', 'Test-Path', 'Invoke-Expression', 'robocopy', 'Get-LocalizedString')
$previousTestFunctions = @{}
foreach($testFunctionName in $testFunctionNames)
{
    $previousTestFunction = Get-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
    if ($previousTestFunction)
    {
        $previousTestFunctions[$testFunctionName] = $previousTestFunction.ScriptBlock
    }
}
$testVariableNames = @('robocopyInvocations', 'copyJobInvocations', 'invokeExpressionCommands', 'featureLookupCallCount', 'useSanitizerCall', 'useSanitizerActivate')
$previousTestVariables = @{}
foreach($testVariableName in $testVariableNames)
{
    $previousTestVariable = Get-Variable -Name $testVariableName -Scope Global -ErrorAction SilentlyContinue
    if ($previousTestVariable)
    {
        $previousTestVariables[$testVariableName] = $previousTestVariable.Value
    }
}
$global:robocopyInvocations = New-Object System.Collections.Generic.List[object]
$global:copyJobInvocations = New-Object System.Collections.Generic.List[object]
$global:invokeExpressionCommands = New-Object System.Collections.Generic.List[string]
$global:featureLookupCallCount = 0
$global:useSanitizerCall = $true
$global:useSanitizerActivate = $true

try
{
    $env:AZP_75787_ENABLE_NEW_LOGIC = "true"

    Register-Mock Import-Module {
        param([string]$Name)
        if ($Name -match 'Sanitizer') {
            Microsoft.PowerShell.Core\Import-Module -Name $Name -Global
        }
    }
    Register-Mock Get-ResourceFQDNTagKey { return 'FQDN' }
    Register-Mock Get-SanitizerCallStatus { return $global:useSanitizerCall }
    Register-Mock Get-SanitizerActivateStatus { return $global:useSanitizerActivate }
    Register-Mock Protect-ScriptArguments { return @('/XF', 'C:\folder with spaces\file.txt') }
    Register-Mock Invoke-Command {
        param([scriptblock]$ScriptBlock, [object[]]$ArgumentList)

        $global:copyJobInvocations.Add([PSCustomObject]@{
            ScriptBlock = $ScriptBlock
            Arguments = @($ArgumentList)
        })
    }

    function global:Invoke-Command {
        param([scriptblock]$ScriptBlock, [object[]]$ArgumentList)

        $global:copyJobInvocations.Add([PSCustomObject]@{
            ScriptBlock = $ScriptBlock
            Arguments = @($ArgumentList)
        })
    }
    function global:Test-Path {
        param([string]$Path, [string]$LiteralPath, [string]$PathType)

        if ($Path -match 'Agent\\Worker|externals\\vstshost')
        {
            return $false
        }

        return $PathType -ne 'Leaf'
    }
    function global:Get-LocalizedString {
        param([string]$Key)

        return $Key
    }
    function global:Get-VstsPipelineFeature {
        param([string]$FeatureName)

        $global:featureLookupCallCount++
        return [System.Convert]::ToBoolean($env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING)
    }
    function global:robocopy {
        $global:robocopyInvocations.Add(@($args))
        $global:LASTEXITCODE = 0
    }
    function global:Invoke-Expression {
        param([string]$Command)

        $global:invokeExpressionCommands.Add($Command)
        Microsoft.PowerShell.Utility\Invoke-Expression $Command
    }

    $filePath = 'C:\folder with spaces\file.txt'
    $legacyArguments = "/XF $filePath"
    $testCases = @(
        [PSCustomObject]@{ FeatureEnabled = "false"; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = $legacyArguments; ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $true; ExpectedRoboCopyArguments = @('/COPY:DAT /E /XF C:\folder with spaces\file.txt') },
        [PSCustomObject]@{ FeatureEnabled = "true"; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) },
        [PSCustomObject]@{ FeatureEnabled = "true"; UseSanitizerCall = $false; UseSanitizerActivate = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) }
    )
    foreach($testCase in $testCases)
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $testCase.FeatureEnabled
        $global:featureLookupCallCount = 0
        $global:useSanitizerCall = $testCase.UseSanitizerCall
        $global:useSanitizerActivate = $testCase.UseSanitizerActivate

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments '/XF "C:\folder with spaces\file.txt"' -cleanTargetBeforeCopy "false"

        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        Assert-AreEqual $testCase.ExpectedFeatureLookupCalls $global:featureLookupCallCount
        $actualAdditionalArguments = $copyJobInvocation.Arguments[5]
        if ($actualAdditionalArguments -isnot [array])
        {
            $actualAdditionalArguments = @($actualAdditionalArguments)
        }

        $expectedAdditionalArguments = $testCase.ExpectedArguments
        if ($expectedAdditionalArguments -isnot [array])
        {
            $expectedAdditionalArguments = @($expectedAdditionalArguments)
        }
        Assert-AreEqual $expectedAdditionalArguments.Count $actualAdditionalArguments.Count
        for($i = 0; $i -lt $expectedAdditionalArguments.Count; $i++)
        {
            Assert-AreEqual $expectedAdditionalArguments[$i] $actualAdditionalArguments[$i]
        }
        Assert-AreEqual $testCase.UseSanitizerActivate $copyJobInvocation.Arguments[6]
        Assert-AreEqual ([System.Convert]::ToBoolean($testCase.FeatureEnabled)) $copyJobInvocation.Arguments[7]

        $invokeExpressionCommandCount = $global:invokeExpressionCommands.Count
        $copyJobArguments = $copyJobInvocation.Arguments
        & $copyJobInvocation.ScriptBlock @copyJobArguments

        $robocopyInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
        $robocopyValues = @($robocopyInvocation | ForEach-Object {
            if ($_ -is [array])
            {
                return ($_ -join ' ')
            }

            return $_
        })

        $usesInvokeExpression = ($global:invokeExpressionCommands.Count - $invokeExpressionCommandCount) -gt 0
        Assert-AreEqual $testCase.ExpectedUsesInvokeExpression $usesInvokeExpression
        if ($testCase.ExpectedUsesInvokeExpression)
        {
            $command = $global:invokeExpressionCommands[$global:invokeExpressionCommands.Count - 1]
            Assert-AreEqual $true ($command.StartsWith('robocopy "'))
            Assert-AreEqual $true ($command.Contains('/XF C:\folder with spaces\file.txt'))
        }
        Assert-AreEqual $testCase.ExpectedNestedArgument (($robocopyInvocation | Where-Object { $_ -is [array] }).Count -gt 0)
        foreach($expectedArgument in $testCase.ExpectedRoboCopyArguments)
        {
            Assert-AreEqual $true ($robocopyValues -contains $expectedArgument)
        }

        Assert-AreEqual $testCase.ExpectedFeatureLookupCalls $global:featureLookupCallCount
    }

    $legacyCopyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
    $legacyCopyJobArguments = @($legacyCopyJobInvocation.Arguments)
    $legacyCopyJobArguments[6] = $false
    $legacyCopyJobArguments[7] = $false
    $invokeExpressionCommandCount = $global:invokeExpressionCommands.Count
    & $legacyCopyJobInvocation.ScriptBlock @legacyCopyJobArguments

    Assert-AreEqual $true (($global:invokeExpressionCommands.Count - $invokeExpressionCommandCount) -gt 0)
    $legacyCommand = $global:invokeExpressionCommands[$global:invokeExpressionCommands.Count - 1]
    Assert-AreEqual $true ($legacyCommand.Contains('/XF C:\folder with spaces\file.txt'))
}
finally
{
    Unregister-Mock Import-Module
    Unregister-Mock Invoke-Command
    Unregister-Mock Get-ResourceFQDNTagKey
    Unregister-Mock Get-SanitizerCallStatus
    Unregister-Mock Get-SanitizerActivateStatus
    Unregister-Mock Protect-ScriptArguments

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

    foreach($testVariableName in $testVariableNames)
    {
        if ($previousTestVariables.ContainsKey($testVariableName))
        {
            Set-Variable -Name $testVariableName -Scope Global -Value $previousTestVariables[$testVariableName]
        }
        else
        {
            Remove-Variable -Name $testVariableName -Scope Global -ErrorAction SilentlyContinue
        }
    }
    [Environment]::SetEnvironmentVariable('AZP_75787_ENABLE_NEW_LOGIC', $previousSanitizerSetting, 'Process')
    [Environment]::SetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', $previousHardeningSetting, 'Process')
}