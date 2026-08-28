[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$previousRetrySetting = [Environment]::GetEnvironmentVariable('MODIFY_NUMBER_OF_RETRIES_IN_ROBOCOPY', 'Process')
$previousSanitizerSetting = [Environment]::GetEnvironmentVariable('AZP_75787_ENABLE_NEW_LOGIC', 'Process')
$previousHardeningSetting = [Environment]::GetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', 'Process')
$testFunctionNames = @('Get-VstsPipelineFeature', 'Get-PipelineFeatureFlag', 'New-Item', 'Remove-Item', 'New-PSDrive', 'Remove-PSDrive', 'Test-Path', 'ConvertTo-SecureString', 'Invoke-Expression', 'robocopy')
$previousTestFunctions = @{}
foreach($testFunctionName in $testFunctionNames)
{
    $previousTestFunction = Get-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
    if ($previousTestFunction)
    {
        $previousTestFunctions[$testFunctionName] = $previousTestFunction.ScriptBlock
    }
}
$testVariableNames = @('robocopyInvocations', 'copyJobInvocations', 'invokeExpressionCommands', 'featureLookupFails', 'featureLookupMissing', 'featureLookupCallCount', 'useSanitizerCall', 'useSanitizerActivate')
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
$global:featureLookupFails = $false
$global:featureLookupMissing = $false
$global:featureLookupCallCount = 0
$global:useSanitizerCall = $true
$global:useSanitizerActivate = $true

function global:Get-PipelineFeatureFlag {
    param([string]$FeatureName, [string]$DisabledReason)

    if ($global:featureLookupMissing) { return $false }
    try { return (Get-VstsPipelineFeature -FeatureName $FeatureName -ErrorAction Stop) }
    catch { return $false }
}

try
{
    $env:MODIFY_NUMBER_OF_RETRIES_IN_ROBOCOPY = "false"
    $env:AZP_75787_ENABLE_NEW_LOGIC = "true"

    Register-Mock Import-Module {
        param([string]$Name)
        if ($Name -match 'Sanitizer') {
            Microsoft.PowerShell.Core\Import-Module -Name $Name -Global
        }
    }
    Register-Mock Get-Command {
        if ($global:featureLookupMissing)
        {
            return $null
        }

        return $true
    }
    Register-Mock Get-SanitizerCallStatus { return $global:useSanitizerCall }
    Register-Mock Get-SanitizerActivateStatus { return $global:useSanitizerActivate }
    Register-Mock Protect-ScriptArguments { return @('/XF', 'C:\folder with spaces\file.txt') }
    Register-Mock Get-VstsInput { return "machine" } -ParametersEvaluator { $Name -eq "MachineNames" }
    Register-Mock Get-VstsInput { return "user" } -ParametersEvaluator { $Name -eq "AdminUserName" }
    Register-Mock Get-VstsInput { return "password" } -ParametersEvaluator { $Name -eq "AdminPassword" }
    Register-Mock Get-VstsInput { return "C:\source" } -ParametersEvaluator { $Name -eq "SourcePath" }
    Register-Mock Get-VstsInput { return "C:\target" } -ParametersEvaluator { $Name -eq "TargetPath" }
    Register-Mock Get-VstsInput { return '/XF "C:\folder with spaces\file.txt"' } -ParametersEvaluator { $Name -eq "AdditionalArguments" }
    Register-Mock Get-VstsInput { return "true" } -ParametersEvaluator { $Name -eq "CleanTargetBeforeCopy" }
    Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "CopyFilesInParallel" }
    Register-Mock Invoke-Command {
        param([scriptblock]$ScriptBlock, [object[]]$ArgumentList)

        $global:copyJobInvocations.Add([PSCustomObject]@{
            ScriptBlock = $ScriptBlock
            Arguments = @($ArgumentList)
        })
    }

    function global:New-Item { }
    function global:Remove-Item { }
    function global:New-PSDrive { }
    function global:Remove-PSDrive { }
    function global:Test-Path {
        param([string]$Path, [string]$PathType)

        return $PathType -ne 'Leaf'
    }
    function global:ConvertTo-SecureString {
        param([string]$String)

        $secureString = New-Object System.Security.SecureString
        foreach($character in $String.ToCharArray()) {
            $secureString.AppendChar($character)
        }
        $secureString.MakeReadOnly()
        return $secureString
    }
    function global:Get-VstsPipelineFeature {
        param([string]$FeatureName)

        $global:featureLookupCallCount++
        if ($global:featureLookupFails)
        {
            throw "Unable to evaluate the task feature."
        }

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
        [PSCustomObject]@{ FeatureEnabled = "false"; UseSanitizerCall = $true; UseSanitizerActivate = $true; FeatureLookupFails = $false; FeatureLookupMissing = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = $legacyArguments; ExpectedCleanupUsesInvokeExpression = $true; ExpectedNestedArgument = $true; ExpectedNormalArguments = @('/COPY:DAT  /E /XF C:\folder with spaces\file.txt') },
        [PSCustomObject]@{ FeatureEnabled = "true"; UseSanitizerCall = $true; UseSanitizerActivate = $true; FeatureLookupFails = $false; FeatureLookupMissing = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) },
        [PSCustomObject]@{ FeatureEnabled = "true"; UseSanitizerCall = $false; UseSanitizerActivate = $false; FeatureLookupFails = $false; FeatureLookupMissing = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) },
        [PSCustomObject]@{ FeatureEnabled = "false"; UseSanitizerCall = $true; UseSanitizerActivate = $true; FeatureLookupFails = $true; FeatureLookupMissing = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = $legacyArguments; ExpectedCleanupUsesInvokeExpression = $true; ExpectedNestedArgument = $true; ExpectedNormalArguments = @('/COPY:DAT  /E /XF C:\folder with spaces\file.txt') },
        [PSCustomObject]@{ FeatureEnabled = "false"; UseSanitizerCall = $true; UseSanitizerActivate = $true; FeatureLookupFails = $false; FeatureLookupMissing = $true; ExpectedFeatureLookupCalls = 0; ExpectedArguments = $legacyArguments; ExpectedCleanupUsesInvokeExpression = $true; ExpectedNestedArgument = $true; ExpectedNormalArguments = @('/COPY:DAT  /E /XF C:\folder with spaces\file.txt') }
    )
    foreach($testCase in $testCases)
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $testCase.FeatureEnabled
        $global:featureLookupFails = $testCase.FeatureLookupFails
        $global:featureLookupMissing = $testCase.FeatureLookupMissing
        $global:featureLookupCallCount = 0
        $global:useSanitizerCall = $testCase.UseSanitizerCall
        $global:useSanitizerActivate = $testCase.UseSanitizerActivate

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1

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
        Assert-AreEqual $testCase.UseSanitizerActivate $copyJobInvocation.Arguments[7]
        Assert-AreEqual ([System.Convert]::ToBoolean($testCase.FeatureEnabled) -and -not $testCase.FeatureLookupFails -and -not $testCase.FeatureLookupMissing) $copyJobInvocation.Arguments[8]

        $copyJobArguments = $copyJobInvocation.Arguments
        $invokeExpressionCommandCount = $global:invokeExpressionCommands.Count
        & $copyJobInvocation.ScriptBlock @copyJobArguments

        $cleanupInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 2]
        $normalInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
        $normalInvocationValues = @($normalInvocation | ForEach-Object {
            if ($_ -is [array])
            {
                return ($_ -join ' ')
            }

            return $_
        })

        Assert-AreEqual "*.*" $cleanupInvocation[2]
        Assert-AreEqual "/NOCOPY" $cleanupInvocation[3]
        Assert-AreEqual "/E" $cleanupInvocation[4]
        Assert-AreEqual "/PURGE" $cleanupInvocation[5]
        $cleanupUsesInvokeExpression = ($global:invokeExpressionCommands.Count - $invokeExpressionCommandCount) -gt 0
        Assert-AreEqual $testCase.ExpectedCleanupUsesInvokeExpression $cleanupUsesInvokeExpression
        if ($testCase.ExpectedCleanupUsesInvokeExpression)
        {
            $cleanupCommand = $global:invokeExpressionCommands[$global:invokeExpressionCommands.Count - 1]
            Assert-AreEqual $true ($cleanupCommand.StartsWith('robocopy "'))
            Assert-AreEqual $true ($cleanupCommand.Contains('" "*.*" /NOCOPY /E /PURGE'))
        }
        Assert-AreEqual $testCase.ExpectedNestedArgument (($normalInvocation | Where-Object { $_ -is [array] }).Count -gt 0)
        foreach($expectedArgument in $testCase.ExpectedNormalArguments)
        {
            Assert-AreEqual $true ($normalInvocationValues -contains $expectedArgument)
        }

        Assert-AreEqual $testCase.ExpectedFeatureLookupCalls $global:featureLookupCallCount
    }
}
finally
{
    Unregister-Mock Get-Command
    Unregister-Mock Get-VstsInput
    Unregister-Mock Import-Module
    Unregister-Mock Invoke-Command
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

    $global:featureLookupFails = $false
    $global:featureLookupMissing = $false
    $global:featureLookupCallCount = 0
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
    [Environment]::SetEnvironmentVariable('MODIFY_NUMBER_OF_RETRIES_IN_ROBOCOPY', $previousRetrySetting, 'Process')
    [Environment]::SetEnvironmentVariable('AZP_75787_ENABLE_NEW_LOGIC', $previousSanitizerSetting, 'Process')
    [Environment]::SetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', $previousHardeningSetting, 'Process')
}
