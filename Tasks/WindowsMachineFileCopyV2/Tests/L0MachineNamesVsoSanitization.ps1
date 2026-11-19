[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

$previousFeatureFunction = Get-Item -Path "function:\global:Get-VstsPipelineFeature" -ErrorAction SilentlyContinue
$previousSanitizationFlag = Get-Variable -Name sanitizationFlag -Scope Global -ErrorAction SilentlyContinue
$previousInvocations = Get-Variable -Name copyJobInvocations -Scope Global -ErrorAction SilentlyContinue
$global:sanitizationFlag = $false
$global:copyJobInvocations = New-Object System.Collections.Generic.List[object]

try
{
    function global:Get-VstsPipelineFeature {
        param([string]$FeatureName)

        return ($FeatureName -eq 'EnableWindowsMachineFileCopyMachineNamesSanitization') -and $global:sanitizationFlag
    }

    Unregister-Mock Get-VstsInput
    Unregister-Mock Invoke-Command

    $global:machineNamesInput = $null
    Register-Mock Get-VstsInput { return $global:machineNamesInput } -ParametersEvaluator { $Name -eq "MachineNames" }
    Register-Mock Get-VstsInput { return "UserName" } -ParametersEvaluator { $Name -eq "AdminUserName" }
    Register-Mock Get-VstsInput { return $password } -ParametersEvaluator { $Name -eq "AdminPassword" }
    Register-Mock Get-VstsInput { return $validSourcePackage } -ParametersEvaluator { $Name -eq "SourcePath" }
    Register-Mock Get-VstsInput { return $validApplicationPath } -ParametersEvaluator { $Name -eq "TargetPath" }
    Register-Mock Get-VstsInput { return $true } -ParametersEvaluator { $Name -eq "CleanTargetBeforeCopy" }
    Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "CopyFilesInParallel" }
    Register-Mock Get-SanitizerCallStatus { return $false }
    Register-Mock Get-SanitizerActivateStatus { return $false }
    Register-Mock Invoke-Command {
        param([scriptblock]$ScriptBlock, [object[]]$ArgumentList)

        $global:copyJobInvocations.Add($ArgumentList[0])
    }

    function Invoke-Task {
        param([string]$MachineNames, [bool]$FlagEnabled)

        $global:sanitizationFlag = $FlagEnabled
        $global:machineNamesInput = $MachineNames
        $global:copyJobInvocations.Clear()
        $output = @(& "$copyFilesToMachinesPath")
        return [PSCustomObject]@{
            Machines = $global:copyJobInvocations.ToArray()
            Lines = @($output | ForEach-Object { "$_" -split "`r?`n" })
        }
    }

    function Assert-NoVsoCommandLine {
        param([string[]]$Lines)

        foreach ($line in $Lines) {
            Assert-AreEqual $false ($line -match '(?i)#+vso\[') "Unexpected logging command in output: $line"
        }
    }

    $payload = '##vso[task.setvariable variable=BASH_ENV]$(printf PROOF_EXEC >&2)'
    $injectedName = "127.0.0.1:1`n$payload"

    # Flag on: the marker is neutralized in the machine name and in the echoed output.
    $result = Invoke-Task -MachineNames $injectedName -FlagEnabled $true
    Assert-AreEqual 1 $result.Machines.Count
    Assert-AreEqual "127.0.0.1:1`n##_vso[task.setvariable variable=BASH_ENV]`$(printf PROOF_EXEC >&2)" $result.Machines[0]
    Assert-NoVsoCommandLine $result.Lines

    # Flag on: every casing and hash-count variant is neutralized, whatever creates the fake line.
    foreach ($variant in @('##vso[', '##VSO[', '##VsO[', '#vso[', '###vso[', '####vso['))
    {
        $result = Invoke-Task -MachineNames "host1`r`n${variant}task.complete result=Failed;]" -FlagEnabled $true
        Assert-AreEqual 1 $result.Machines.Count
        Assert-AreEqual $false ($result.Machines[0] -match '(?i)#+vso\[') "Variant not neutralized: $variant"
        Assert-AreEqual $true ($result.Machines[0].Contains('##_vso['))
        Assert-NoVsoCommandLine $result.Lines
    }

    # Flag on: marker embedded without any newline, and in one of several comma separated names.
    $result = Invoke-Task -MachineNames "host1, a##vso[task.complete result=Failed;], host2" -FlagEnabled $true
    Assert-AreEqual 3 $result.Machines.Count
    Assert-AreEqual 'host1' $result.Machines[0]
    Assert-AreEqual 'a##_vso[task.complete result=Failed;]' $result.Machines[1]
    Assert-AreEqual 'host2' $result.Machines[2]

    # Flag on: ordinary host names, FQDNs, IPs and ports pass through unchanged (trimmed, empties dropped).
    $result = Invoke-Task -MachineNames " host1 , host2.contoso.com:5986,,10.0.0.1:5985 ,[::1]:5986 " -FlagEnabled $true
    Assert-AreEqual 4 $result.Machines.Count
    Assert-AreEqual 'host1' $result.Machines[0]
    Assert-AreEqual 'host2.contoso.com:5986' $result.Machines[1]
    Assert-AreEqual '10.0.0.1:5985' $result.Machines[2]
    Assert-AreEqual '[::1]:5986' $result.Machines[3]

    # Flag off: legacy behavior is unchanged.
    $result = Invoke-Task -MachineNames $injectedName -FlagEnabled $false
    Assert-AreEqual 1 $result.Machines.Count
    Assert-AreEqual $injectedName $result.Machines[0]

    $result = Invoke-Task -MachineNames " host1 , host2.contoso.com:5986 " -FlagEnabled $false
    Assert-AreEqual 2 $result.Machines.Count
    Assert-AreEqual 'host1' $result.Machines[0]
    Assert-AreEqual 'host2.contoso.com:5986' $result.Machines[1]
}
finally
{
    Unregister-Mock Get-VstsInput
    Unregister-Mock Invoke-Command
    Unregister-Mock Get-SanitizerCallStatus
    Unregister-Mock Get-SanitizerActivateStatus

    if ($previousFeatureFunction)
    {
        Set-Item -Path "function:\global:Get-VstsPipelineFeature" -Value $previousFeatureFunction.ScriptBlock
    }
    else
    {
        Microsoft.PowerShell.Management\Remove-Item -Path "function:\global:Get-VstsPipelineFeature" -ErrorAction SilentlyContinue
    }

    foreach ($state in @(@('sanitizationFlag', $previousSanitizationFlag), @('copyJobInvocations', $previousInvocations)))
    {
        if ($state[1]) { Set-Variable -Name $state[0] -Scope Global -Value $state[1].Value }
        else { Remove-Variable -Name $state[0] -Scope Global -ErrorAction SilentlyContinue }
    }
    Remove-Variable -Name machineNamesInput -Scope Global -ErrorAction SilentlyContinue
}
