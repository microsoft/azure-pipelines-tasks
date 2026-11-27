[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$previousSanitizerSetting = [Environment]::GetEnvironmentVariable('AZP_75787_ENABLE_NEW_LOGIC', 'Process')
$previousHardeningSetting = [Environment]::GetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', 'Process')
$testFunctionNames = @('Get-VstsPipelineFeature', 'Get-VstsTaskVariable', 'Test-Path', 'Invoke-Expression', 'robocopy', 'Get-LocalizedString', 'Get-ChildItem', 'Remove-Item')
$previousTestFunctions = @{}
foreach($testFunctionName in $testFunctionNames)
{
    $previousTestFunction = Get-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
    if ($previousTestFunction)
    {
        $previousTestFunctions[$testFunctionName] = $previousTestFunction.ScriptBlock
    }
}
$testVariableNames = @('robocopyInvocations', 'copyJobInvocations', 'invokeExpressionCommands', 'featureLookupCallCount', 'useSanitizerCall', 'useSanitizerActivate', 'netUseFlag', 'additionalArgumentsInput', 'sanitizerResult', 'sourceIsFile')
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
$global:netUseFlag = $false
$global:additionalArgumentsInput = '/XF "C:\folder with spaces\file.txt"'
$global:sanitizerResult = @('/XF', 'C:\folder with spaces\file.txt')
$global:sourceIsFile = $false

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
    Register-Mock Protect-ScriptArguments { return $global:sanitizerResult }
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

        if ($PathType -eq 'Leaf')
        {
            return $global:sourceIsFile
        }

        return $true
    }
    function global:Get-LocalizedString {
        param([string]$Key)

        return $Key
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
    function global:Get-VstsPipelineFeature {
        param([string]$FeatureName)

        if ($FeatureName -eq 'EnableLegacyWindowsMachineFileCopyNetUseCommand')
        {
            return $global:netUseFlag
        }

        return $false
    }
    function global:robocopy {
        $global:robocopyInvocations.Add(@($args))
        $global:LASTEXITCODE = 0
    }
    function global:Get-ChildItem { }
    function global:Remove-Item { }
    function global:Invoke-Expression {
        param([string]$Command)

        $global:invokeExpressionCommands.Add($Command)
        Microsoft.PowerShell.Utility\Invoke-Expression $Command
    }

    $filePath = 'C:\folder with spaces\file.txt'
    $legacyArguments = "/XF $filePath"
    $testCases = @(
        [PSCustomObject]@{ FeatureValue = 'False'; ExpectedHardening = $false; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = $legacyArguments; ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $true; ExpectedRoboCopyArguments = @('/COPY:DAT /E /XF C:\folder with spaces\file.txt') },
        [PSCustomObject]@{ FeatureValue = $null; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) },
        [PSCustomObject]@{ FeatureValue = $null; ExpectedHardening = $true; UseSanitizerCall = $false; UseSanitizerActivate = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) },
        [PSCustomObject]@{ FeatureValue = 'True'; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) },
        [PSCustomObject]@{ FeatureValue = 'True'; ExpectedHardening = $true; UseSanitizerCall = $false; UseSanitizerActivate = $false; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) },
        [PSCustomObject]@{ FeatureValue = 'unexpected'; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $true; ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) },
        [PSCustomObject]@{ FeatureValue = $null; ExpectedHardening = $true; UseSanitizerCall = $true; UseSanitizerActivate = $false; SanitizerResult = @('/XF', 'SANITIZER-OUTPUT'); ExpectedFeatureLookupCalls = 1; ExpectedArguments = @('/XF', $filePath); ExpectedUsesInvokeExpression = $false; ExpectedNestedArgument = $false; ExpectedRoboCopyArguments = @('/COPY:DAT', '/E', '/XF', $filePath) }
    )
    foreach($testCase in $testCases)
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $testCase.FeatureValue
        $global:featureLookupCallCount = 0
        $global:useSanitizerCall = $testCase.UseSanitizerCall
        $global:useSanitizerActivate = $testCase.UseSanitizerActivate
        $global:sanitizerResult = if ($testCase.SanitizerResult) { $testCase.SanitizerResult } else { @('/XF', $filePath) }

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments $global:additionalArgumentsInput -cleanTargetBeforeCopy "false"

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
        Assert-AreEqual $testCase.ExpectedHardening $copyJobInvocation.Arguments[7]

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
        Assert-AreEqual 'C:\source' $robocopyInvocation[0]
        Assert-AreEqual 'C:\target' $robocopyInvocation[1]
        Assert-AreEqual '' $robocopyInvocation[2]
        if (-not $testCase.ExpectedNestedArgument)
        {
            # <source> <destination> <files to copy, empty for a directory source> then the fixed and additional arguments.
            Assert-AreEqual ($testCase.ExpectedRoboCopyArguments.Count + 3) $robocopyInvocation.Count
        }
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
    $legacyInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual 'C:\source' $legacyInvocation[0]
    Assert-AreEqual 'C:\target' $legacyInvocation[1]
    Assert-AreEqual '' $legacyInvocation[2]

    $global:additionalArgumentsInput = '/XF "C:\a b\c.txt" $env:WMFC_SAMPLE'
    $global:useSanitizerCall = $false
    $global:useSanitizerActivate = $false
    $env:WMFC_SAMPLE = 'sample-value'
    foreach($featureValue in @($null, 'False'))
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $featureValue

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments $global:additionalArgumentsInput -cleanTargetBeforeCopy "false"

        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        $copyJobArguments = $copyJobInvocation.Arguments
        & $copyJobInvocation.ScriptBlock @copyJobArguments

        $normalInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
        Assert-AreEqual 'C:\source' $normalInvocation[0]
        Assert-AreEqual 'C:\target' $normalInvocation[1]
        Assert-AreEqual '' $normalInvocation[2]
        Assert-AreEqual $true (@($normalInvocation | ForEach-Object { $_ }) -contains 'C:\a b\c.txt')
        if ($featureValue -eq 'False')
        {
            Assert-AreEqual $true (@($normalInvocation | ForEach-Object { $_ }) -contains 'sample-value')
            $legacyJobArguments = $copyJobArguments
        }
        else
        {
            Assert-AreEqual $true (@($normalInvocation) -contains '$env:WMFC_SAMPLE')
            $hardenedArguments = $copyJobArguments
        }
    }

    # Omitting the hardening argument must give the hardened behavior.
    $a = $hardenedArguments
    & $copyJobInvocation.ScriptBlock -fqdn $a[0] -sourcePath $a[1] -targetPath $a[2] -credential $a[3] -cleanTargetBeforeCopy $a[4] -additionalArguments $a[5] -useSanitizerActivate $a[6] -scriptRoot $a[8] -enableLegacyWindowsMachineFileCopyNetUseCommand $a[9]
    $defaultInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual $true (@($defaultInvocation) -contains '$env:WMFC_SAMPLE')

    & $copyJobInvocation.ScriptBlock -fqdn $a[0] -sourcePath $a[1] -targetPath $a[2] -credential $a[3] -cleanTargetBeforeCopy 'true' -additionalArguments $a[5] -useSanitizerActivate $a[6] -scriptRoot $a[8] -enableLegacyWindowsMachineFileCopyNetUseCommand $a[9]
    $cleanInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual $true (@($cleanInvocation) -contains '/MIR')
    Assert-AreEqual $false (@($cleanInvocation) -contains '/E')
    Assert-AreEqual $true (@($cleanInvocation) -contains '$env:WMFC_SAMPLE')

    $legacyCleanArguments = $legacyJobArguments.Clone()
    $legacyCleanArguments[4] = 'true'
    & $copyJobInvocation.ScriptBlock @legacyCleanArguments
    $legacyCleanInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual $true (@($legacyCleanInvocation | ForEach-Object { $_ }) -contains '/MIR')
    Assert-AreEqual $false (@($legacyCleanInvocation | ForEach-Object { $_ }) -contains '/E')

    # Only an explicit false (any casing) turns the hardening off.
    foreach($featureState in @(@($null, $true), @('', $true), @('True', $true), @('true', $true), @('0', $true), @('False', $false), @('false', $false), @('FALSE', $false)))
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $featureState[0]
        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments $global:additionalArgumentsInput -cleanTargetBeforeCopy "false"
        Assert-AreEqual $featureState[1] $global:copyJobInvocations[$global:copyJobInvocations.Count - 1].Arguments[7]
    }
    $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $null

    # Empty input leaves only the fixed arguments; a single-file source copies that file without /E.
    foreach($emptyValue in @('', '   ', $null))
    {
        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments $emptyValue -cleanTargetBeforeCopy "false"

        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        $copyJobArguments = $copyJobInvocation.Arguments
        & $copyJobInvocation.ScriptBlock @copyJobArguments

        $emptyInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
        Assert-AreEqual 5 $emptyInvocation.Count
        Assert-AreEqual '/COPY:DAT' $emptyInvocation[3]
        Assert-AreEqual '/E' $emptyInvocation[4]
    }

    $global:sourceIsFile = $true
    & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source\file.txt" -targetPath "C:\target" -additionalArguments '/XF x' -cleanTargetBeforeCopy "false"
    $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
    $copyJobArguments = $copyJobInvocation.Arguments
    & $copyJobInvocation.ScriptBlock @copyJobArguments
    $fileInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual 6 $fileInvocation.Count
    Assert-AreEqual 'C:\source' $fileInvocation[0]
    Assert-AreEqual 'C:\target' $fileInvocation[1]
    Assert-AreEqual 'file.txt' $fileInvocation[2]
    Assert-AreEqual '/COPY:DAT' $fileInvocation[3]
    Assert-AreEqual '/XF' $fileInvocation[4]
    Assert-AreEqual 'x' $fileInvocation[5]

    $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = 'False'
    & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source\file.txt" -targetPath "C:\target" -additionalArguments '/XF x' -cleanTargetBeforeCopy "false"
    $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
    $copyJobArguments = $copyJobInvocation.Arguments
    & $copyJobInvocation.ScriptBlock @copyJobArguments
    $legacyFileInvocation = $global:robocopyInvocations[$global:robocopyInvocations.Count - 1]
    Assert-AreEqual 'file.txt' $legacyFileInvocation[2]
    Assert-AreEqual $false (@($legacyFileInvocation | ForEach-Object { $_ }) -contains '/E')
    $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $null
    $global:sourceIsFile = $false

    $global:additionalArgumentsInput = ''
    foreach($case in @(
        @{ Feature = $null; NetUse = $true; Hardened = $true },
        @{ Feature = 'False'; NetUse = $true; Hardened = $false },
        @{ Feature = 'False'; NetUse = $false; Hardened = $false },
        @{ Feature = 'True'; NetUse = $true; Hardened = $true }))
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $case.Feature
        $global:netUseFlag = $case.NetUse

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments $global:additionalArgumentsInput -cleanTargetBeforeCopy "false"

        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        Assert-AreEqual $case.Hardened $copyJobInvocation.Arguments[7]
        Assert-AreEqual ($case.NetUse -and -not $case.Hardened) $copyJobInvocation.Arguments[9]
    }
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
    [Environment]::SetEnvironmentVariable('WMFC_SAMPLE', $null, 'Process')
}