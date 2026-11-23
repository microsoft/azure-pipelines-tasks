[CmdletBinding()]
param()

# Regression test for the upgrade monitoring loop. It prints text the cluster provides - upgrade state, upgrade
# domain status and health evaluation descriptions - which the pipeline does not control. A logging command in them
# must never reach the agent as a command.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$injection = '##vso[task.setvariable variable=INJECTED]x'

function New-UpgradeStatus
{
    param([string]$State = 'RollingForwardCompleted', [string]$DomainStatus, [string]$Description)

    [pscustomobject]@{
        UpgradeState         = $State
        UpgradeDomainsStatus = @($DomainStatus)
        UnhealthyEvaluations = [pscustomobject]@{
            Kind                 = 'Application'
            Description          = $Description
            UnhealthyEvaluations = @()
        }
    }
}

$global:UpgradeStatusUnderTest = $null
Register-Mock Get-ServiceFabricApplicationUpgrade { $global:UpgradeStatusUnderTest }
# The retry loop is not under test, and it only accepts exception types that exist once the Service Fabric SDK is
# loaded.
Register-Mock Invoke-ActionWithRetries { param([scriptblock]$Action) & $Action $null }
Register-HostCapture

. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act 1: ordinary values are written exactly as before and raise no audit event.
$global:UpgradeStatusUnderTest = New-UpgradeStatus `
    -DomainStatus 'UD0 Completed' -Description 'Service unhealthy: disk full'
$null = Wait-ServiceFabricApplicationUpgradeAction -ApplicationName 'fabric:/App'

Assert-AreEqual 3 $global:LoggedHostLines.Count `
    "Expected the upgrade state, the domain status and the evaluation. $(Get-CapturedHostText)"
Assert-LogLineWritten 'SFSDK_CurrentUpgradeState RollingForwardCompleted'
Assert-LogLineWritten 'SFSDK_DomainUpgradeStatus UD0 Completed'
Assert-LogLineWritten 'Service unhealthy: disk full'
Assert-NoAuditEventWritten

# Act 2: a marker in the upgrade state, in the domain status and in the evaluation, once at the start of a line and
# twice inside text. Each of the three sinks must raise its own audit event.
Clear-HostCapture
$global:UpgradeStatusUnderTest = New-UpgradeStatus `
    -State "RollingForward $injection" `
    -DomainStatus "UD0 $injection" `
    -Description "disk full`n$injection"
$null = Wait-ServiceFabricApplicationUpgradeAction -ApplicationName 'fabric:/App'

Assert-NoLiveLoggingCommands
Assert-AuditEventWritten 'task.setvariable' -Count 3
Assert-LogLineWritten 'SFSDK_CurrentUpgradeState RollingForward ##_vso[task.setvariable variable=INJECTED]x'
Assert-LogLineWritten 'SFSDK_DomainUpgradeStatus UD0 ##_vso[task.setvariable variable=INJECTED]x'
Assert-LogLineWritten "disk full`n##_vso[task.setvariable variable=INJECTED]x"
