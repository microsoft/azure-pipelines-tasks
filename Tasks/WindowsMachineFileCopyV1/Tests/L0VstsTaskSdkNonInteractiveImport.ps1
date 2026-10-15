[CmdletBinding()]
param()

# This task runs on the agent's legacy PowerShell host, which does not implement Read-Host.
# Unless VstsTaskSdk is imported with NonInteractive, Get-VstsPipelineFeature (and any other
# Get-VstsTaskVariable lookup) prompts through Read-Host for a variable that is not set, and
# the resulting error record fails the task even though the copy itself succeeds (#22579).

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

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
$previousCopyJobInvocations = Get-Variable -Name 'copyJobInvocations' -Scope Global -ErrorAction SilentlyContinue
$global:copyJobInvocations = New-Object System.Collections.Generic.List[object]

$isVstsTaskSdkImport = { "$($args[0])" -match 'ps_modules[\\/]VstsTaskSdk$' }
$isInteractiveVstsTaskSdkImport = {
    $moduleParameters = @($args | Where-Object { $_ -is [hashtable] })
    $isNonInteractive = $moduleParameters.Count -eq 1 -and $moduleParameters[0]['NonInteractive'] -eq $true
    ("$($args[0])" -match 'ps_modules[\\/]VstsTaskSdk$') -and -not $isNonInteractive
}

try
{
    Register-Mock Import-Module { }
    Register-Mock Get-ResourceFQDNTagKey { return 'FQDN' }
    Register-Mock Get-SanitizerCallStatus { return $false }
    Register-Mock Get-SanitizerActivateStatus { return $false }

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
        $global:LASTEXITCODE = 0
    }
    function Reset-ImportModuleMockCallHistory {
        $mocks = (Get-Module TestHelpersModule).SessionState.PSVariable.GetValue('mocks')
        $mocks['Import-Module'].Invocations = @()
    }

    foreach($featureEnabled in @('false', 'true'))
    {
        $env:DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING = $featureEnabled
        Reset-ImportModuleMockCallHistory

        & $PSScriptRoot\..\WindowsMachineFileCopy.ps1 -environmentName "" -adminUserName "user" -adminPassword "password" -sourcePath "C:\source" -targetPath "C:\target" -additionalArguments "" -cleanTargetBeforeCopy "false"
        $copyJobInvocation = $global:copyJobInvocations[$global:copyJobInvocations.Count - 1]
        $copyJobArguments = $copyJobInvocation.Arguments
        & $copyJobInvocation.ScriptBlock @copyJobArguments

        Assert-WasCalled Import-Module -ArgumentsEvaluator $isVstsTaskSdkImport
        Assert-WasCalled Import-Module -Times 0 -ArgumentsEvaluator $isInteractiveVstsTaskSdkImport
    }
}
finally
{
    Unregister-Mock Import-Module
    Unregister-Mock Get-ResourceFQDNTagKey
    Unregister-Mock Get-SanitizerCallStatus
    Unregister-Mock Get-SanitizerActivateStatus

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

    if ($previousCopyJobInvocations)
    {
        Set-Variable -Name 'copyJobInvocations' -Scope Global -Value $previousCopyJobInvocations.Value
    }
    else
    {
        Remove-Variable -Name 'copyJobInvocations' -Scope Global -ErrorAction SilentlyContinue
    }
    [Environment]::SetEnvironmentVariable('DISTRIBUTEDTASK_TASKS_ENABLEWINDOWSMACHINEFILECOPYARGUMENTSHARDENING', $previousHardeningSetting, 'Process')
}
