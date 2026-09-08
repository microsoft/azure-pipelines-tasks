[CmdletBinding()]
param()

# Drives the hardened Robocopy argument flow end to end. The sanitizer returns
# tokenized additional arguments, the outer task passes that array into the copy
# job, and the job appends those exact tokens to the robocopy invocation without
# joining and re-splitting them.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$previousSanitizerSetting = [Environment]::GetEnvironmentVariable('AZP_75787_ENABLE_NEW_LOGIC', 'Process')
$previousHardeningSetting = [Environment]::GetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', 'Process')
$testFunctionNames = @('Get-VstsPipelineFeature', 'Test-Path', 'Invoke-Command', 'robocopy', 'Get-LocalizedString')
$previousTestFunctions = @{}
foreach($testFunctionName in $testFunctionNames)
{
    $previousTestFunction = Get-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
    if ($previousTestFunction)
    {
        $previousTestFunctions[$testFunctionName] = $previousTestFunction.ScriptBlock
    }
}
$testVariableNames = @('robocopyInvocations', 'copyJobInvocations', 'sanitizedTokens')
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
$global:sanitizedTokens = @()

try
{
    $env:AZP_75787_ENABLE_NEW_LOGIC = "true"
    $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = "true"

    . $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1

    Register-Mock Import-Module { }
    Register-Mock Get-ResourceFQDNTagKey { return 'FQDN' }
    Register-Mock Get-SanitizerCallStatus { return $true }
    Register-Mock Get-SanitizerActivateStatus { return $true }
    Register-Mock Protect-ScriptArguments { return $global:sanitizedTokens }
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

        return [System.Convert]::ToBoolean($env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING)
    }
    function global:robocopy {
        $global:robocopyInvocations.Add(@($args))
        $global:LASTEXITCODE = 0
    }
    function Reset-ImportModuleMockCallHistory {
        $mocks = (Get-Module TestHelpersModule).SessionState.PSVariable.GetValue('mocks')
        $mocks['Import-Module'].Invocations = @()
    }
    # robocopy is always invoked as: <source> <destination> <filesToCopy> /COPY:DAT /E <sanitized tokens...>
    $fixedArgumentCount = 5

    $testCases = @(
        @('/XF', 'C:\folder\file.txt'),
        @('/XF', 'C:\sub folder\a.txt'),
        @('/XF', 'a"b'),
        @('/XF', 'a"b c'),
        @('/LOG:C:\log dir\run.txt', '/XD', 'C:\ex clude', 'plain')
    )

    foreach($expectedTokens in $testCases)
    {
        $global:sanitizedTokens = $expectedTokens

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments "unused" -cleanTargetBeforeCopy "false"
        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        Assert-AreEqual $true $copyJobInvocation.Arguments[7]
        Assert-AreEqual (Split-Path $PSScriptRoot -Parent) $copyJobInvocation.Arguments[8]

        $copyJobArguments = $copyJobInvocation.Arguments
        Reset-ImportModuleMockCallHistory
        & $copyJobInvocation.ScriptBlock @copyJobArguments
        Assert-WasCalled Import-Module -ArgumentsEvaluator { $args.Count -eq 2 -and $args[0] -eq (Join-Path (Split-Path $PSScriptRoot -Parent) 'ps_modules\VstsTaskSdk') -and $args[1] -eq '-Force' }

        $robocopyInvocation = @($global:robocopyInvocations[$global:robocopyInvocations.Count - 1])
        $actualTokens = @($robocopyInvocation | Select-Object -Skip $fixedArgumentCount)

        $copyJobAdditionalArguments = $copyJobInvocation.Arguments[5]
        if ($copyJobAdditionalArguments -isnot [array])
        {
            $copyJobAdditionalArguments = @($copyJobAdditionalArguments)
        }

        Assert-AreEqual $expectedTokens.Count $copyJobAdditionalArguments.Count
        for($i = 0; $i -lt $expectedTokens.Count; $i++)
        {
            Assert-AreEqual $expectedTokens[$i] $copyJobAdditionalArguments[$i]
        }

        Assert-AreEqual $expectedTokens.Count $actualTokens.Count
        for($i = 0; $i -lt $expectedTokens.Count; $i++)
        {
            Assert-AreEqual $expectedTokens[$i] $actualTokens[$i]
        }
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
}
