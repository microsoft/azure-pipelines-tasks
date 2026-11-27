[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$previousRetrySetting = [Environment]::GetEnvironmentVariable('MODIFY_NUMBER_OF_RETRIES_IN_ROBOCOPY', 'Process')
$previousSanitizerSetting = [Environment]::GetEnvironmentVariable('AZP_75787_ENABLE_NEW_LOGIC', 'Process')
$previousHardeningSetting = [Environment]::GetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', 'Process')
$testFunctionNames = @('Get-VstsTaskVariable', 'New-Item', 'Remove-Item', 'New-PSDrive', 'Remove-PSDrive', 'Test-Path', 'ConvertTo-SecureString', 'Invoke-Expression', 'robocopy')
$previousTestFunctions = @{}
foreach($testFunctionName in $testFunctionNames)
{
    $previousTestFunction = Get-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
    if ($previousTestFunction)
    {
        $previousTestFunctions[$testFunctionName] = $previousTestFunction.ScriptBlock
    }
}
$testVariableNames = @('robocopyInvocations', 'copyJobInvocations', 'invokeExpressionCommands', 'featureLookupCallCount', 'useSanitizerCall', 'useSanitizerActivate', 'additionalArgumentsInput', 'sanitizerResult', 'sourceIsFile', 'sourcePathInput')
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
$global:additionalArgumentsInput = '/XF "C:\folder with spaces\file.txt"'
$global:sanitizerResult = @('/XF', 'C:\folder with spaces\file.txt')
$global:sourceIsFile = $false
$global:sourcePathInput = 'C:\source'

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
    Register-Mock Get-SanitizerCallStatus { return $global:useSanitizerCall }
    Register-Mock Get-SanitizerActivateStatus { return $global:useSanitizerActivate }
    Register-Mock Protect-ScriptArguments { return $global:sanitizerResult }
    Register-Mock Get-VstsInput { return "machine" } -ParametersEvaluator { $Name -eq "MachineNames" }
    Register-Mock Get-VstsInput { return "user" } -ParametersEvaluator { $Name -eq "AdminUserName" }
    Register-Mock Get-VstsInput { return "password" } -ParametersEvaluator { $Name -eq "AdminPassword" }
    Register-Mock Get-VstsInput { return $global:sourcePathInput } -ParametersEvaluator { $Name -eq "SourcePath" }
    Register-Mock Get-VstsInput { return "C:\target" } -ParametersEvaluator { $Name -eq "TargetPath" }
    Register-Mock Get-VstsInput { return $global:additionalArgumentsInput } -ParametersEvaluator { $Name -eq "AdditionalArguments" }
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

        if ($PathType -eq 'Leaf')
        {
            return $global:sourceIsFile
        }

        return $true
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
    function global:Get-VstsTaskVariable {
        param([string]$Name)

        if ($Name -ne 'DistributedTask.Tasks.EnableWindowsMachineFileCopyArgumentsHardening')
        {
            return $null
        }

        $global:featureLookupCallCount++
        return $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING
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
        [PSCustomObject]@{ FeatureValue = 'False'; ExpectedHardening = $false; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = $legacyArguments; ExpectedCleanupUsesInvokeExpression = $true; ExpectedNestedArgument = $true; ExpectedNormalArguments = @('/COPY:DAT  /E /XF C:\folder with spaces\file.txt') },
        [PSCustomObject]@{ FeatureValue = $null; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) },
        [PSCustomObject]@{ FeatureValue = $null; ExpectedHardening = $true; UseSanitizerCall = $false; UseSanitizerActivate = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) },
        [PSCustomObject]@{ FeatureValue = 'True'; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) },
        [PSCustomObject]@{ FeatureValue = 'True'; ExpectedHardening = $true; UseSanitizerCall = $false; UseSanitizerActivate = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) },
        [PSCustomObject]@{ FeatureValue = 'unexpected'; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) },
        [PSCustomObject]@{ FeatureValue = $null; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $false; SanitizerResult = @('/XF', 'SANITIZER-OUTPUT'); ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedCleanupUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedNormalArguments = @("/COPY:DAT", "/E", "/XF", $filePath) }
    )
    foreach($testCase in $testCases)
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $testCase.FeatureValue
        $global:featureLookupCallCount = 0
        $global:useSanitizerCall = $testCase.UseSanitizerCall
        $global:useSanitizerActivate = $testCase.UseSanitizerActivate
        $global:sanitizerResult = if ($testCase.SanitizerResult) { $testCase.SanitizerResult } else { @('/XF', $filePath) }

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
        Assert-AreEqual $testCase.ExpectedHardening $copyJobInvocation.Arguments[8]

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
        Assert-AreEqual 6 $cleanupInvocation.Count
        Assert-AreEqual $true ($cleanupInvocation[0].StartsWith("$($copyJobArguments[6])\temp", 'OrdinalIgnoreCase'))
        Assert-AreEqual '\\machine\C$\target' $cleanupInvocation[1]
        $cleanupUsesInvokeExpression = ($global:invokeExpressionCommands.Count - $invokeExpressionCommandCount) -gt 0
        Assert-AreEqual $testCase.ExpectedCleanupUsesInvokeExpression $cleanupUsesInvokeExpression
        if ($testCase.ExpectedCleanupUsesInvokeExpression)
        {
            $cleanupCommand = $global:invokeExpressionCommands[$global:invokeExpressionCommands.Count - 1]
            Assert-AreEqual $true ($cleanupCommand.StartsWith('robocopy "'))
            Assert-AreEqual $true ($cleanupCommand.Contains('" "*.*" /NOCOPY /E /PURGE'))
        }
        Assert-AreEqual $testCase.ExpectedNestedArgument (($normalInvocation | Where-Object { $_ -is [array] }).Count -gt 0)
        Assert-AreEqual 'C:\source' $normalInvocation[0]
        Assert-AreEqual '\\machine\C$\target' $normalInvocation[1]
        Assert-AreEqual '' $normalInvocation[2]
        if (-not $testCase.ExpectedNestedArgument)
        {
            # <source> <destination> <files to copy, empty for a directory source> then the fixed and additional arguments.
            Assert-AreEqual ($testCase.ExpectedNormalArguments.Count + 3) $normalInvocation.Count
        }
        foreach($expectedArgument in $testCase.ExpectedNormalArguments)
        {
            Assert-AreEqual $true ($normalInvocationValues -contains $expectedArgument)
        }

        Assert-AreEqual $testCase.ExpectedFeatureLookupCalls $global:featureLookupCallCount
    }

    $global:additionalArgumentsInput = '/XF "C:\a b\c.txt" $env:WMFC_SAMPLE'
    $global:useSanitizerCall = $false
    $global:useSanitizerActivate = $false
    $env:WMFC_SAMPLE = 'sample-value'
    foreach($featureValue in @($null, 'False'))
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $featureValue

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1

        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        $copyJobArguments = $copyJobInvocation.Arguments
        & $copyJobInvocation.ScriptBlock @copyJobArguments

        $normalInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
        Assert-AreEqual 'C:\source' $normalInvocation[0]
        Assert-AreEqual '\\machine\C$\target' $normalInvocation[1]
        Assert-AreEqual '' $normalInvocation[2]
        Assert-AreEqual $true (@($normalInvocation | ForEach-Object { $_ }) -contains 'C:\a b\c.txt')
        if ($featureValue -eq 'False')
        {
            Assert-AreEqual $true (@($normalInvocation | ForEach-Object { $_ }) -contains 'sample-value')
        }
        else
        {
            Assert-AreEqual $true (@($normalInvocation) -contains '$env:WMFC_SAMPLE')
            $hardenedArguments = $copyJobArguments
        }
    }

    # Omitting the hardening argument must give the hardened behavior.
    $a = $hardenedArguments
    & $copyJobInvocation.ScriptBlock -fqdn $a[0] -sourcePath $a[1] -targetPath $a[2] -credential $a[3] -cleanTargetBeforeCopy $a[4] -additionalArguments $a[5] -scriptRoot $a[6] -useSanitizerActivate $a[7]
    $defaultInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual $true (@($defaultInvocation) -contains '$env:WMFC_SAMPLE')

    # Only an explicit false (any casing) turns the hardening off.
    foreach($featureState in @(@($null, $true), @('', $true), @('True', $true), @('true', $true), @('0', $true), @('False', $false), @('false', $false), @('FALSE', $false)))
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $featureState[0]
        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1
        Assert-AreEqual $featureState[1] $global:copyJobInvocations[$global:copyJobInvocations.Count - 1].Arguments[8]
    }
    $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $null

    # Empty input leaves only the fixed arguments; a single-file source copies that file without /E.
    foreach($emptyValue in @('', '   ', $null))
    {
        $global:additionalArgumentsInput = $emptyValue

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1

        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        $copyJobArguments = $copyJobInvocation.Arguments
        & $copyJobInvocation.ScriptBlock @copyJobArguments

        $emptyInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
        Assert-AreEqual 5 $emptyInvocation.Count
        Assert-AreEqual '/COPY:DAT' $emptyInvocation[3]
        Assert-AreEqual '/E' $emptyInvocation[4]
    }

    $global:sourcePathInput = 'C:\source\file.txt'
    $global:sourceIsFile = $true
    $global:additionalArgumentsInput = '/XF x'
    & $PSScriptRoot\..\WindowsMachineFileCopy.ps1
    $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
    $copyJobArguments = $copyJobInvocation.Arguments
    & $copyJobInvocation.ScriptBlock @copyJobArguments
    $fileInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual 6 $fileInvocation.Count
    Assert-AreEqual 'C:\source' $fileInvocation[0]
    Assert-AreEqual '\\machine\C$\target' $fileInvocation[1]
    Assert-AreEqual 'file.txt' $fileInvocation[2]
    Assert-AreEqual '/COPY:DAT' $fileInvocation[3]
    Assert-AreEqual '/XF' $fileInvocation[4]
    Assert-AreEqual 'x' $fileInvocation[5]

    $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = 'False'
    & $PSScriptRoot\..\WindowsMachineFileCopy.ps1
    $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
    $copyJobArguments = $copyJobInvocation.Arguments
    & $copyJobInvocation.ScriptBlock @copyJobArguments
    $legacyFileInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual 'file.txt' $legacyFileInvocation[2]
    Assert-AreEqual $false (@($legacyFileInvocation | ForEach-Object { $_ }) -contains '/E')
    $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $null
    $global:sourceIsFile = $false
    $global:sourcePathInput = 'C:\source'
}
finally
{
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
    [Environment]::SetEnvironmentVariable('WMFC_SAMPLE', $null, 'Process')
}
