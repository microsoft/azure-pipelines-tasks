param (
    [string]$environmentName,    
    [string]$adminUserName,
    [string]$adminPassword,
    [string]$protocol,
    [string]$testCertificate,
    [string]$resourceFilteringMethod,
    [string]$machineNames,
    [string]$scriptPath,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [string]$runPowershellInParallel,
    [string]$sessionVariables
    )

Write-Verbose "Entering script PowerShellOnTargetMachines.ps1" 
Write-Verbose "environmentName = $environmentName" 
Write-Verbose "adminUserName = $adminUserName" 
Write-Verbose "protocol = $protocol" 
Write-Verbose "testCertificate = $testCertificate" 
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" 
Write-Verbose "machineNames = $machineNames" 
Write-Verbose "scriptPath = $scriptPath" 
Write-Verbose "scriptArguments = $scriptArguments"
Write-Verbose "initializationScriptPath = $initializationScriptPath"
Write-Verbose "runPowershellInParallel = $runPowershellInParallel"
Write-Verbose "sessionVariables = $sessionVariables"

. $PSScriptRoot/PowerShellJob.ps1
. $PSScriptRoot/Utility.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

# DRY-RUN of the ##vso[ command-injection fix (ICM 31000000640794).
# Instead of sanitizing ##vso[ commands from remote machine output, this only publishes telemetry
# describing which ##vso[ commands WOULD have been blocked. The remote output is still written
# unchanged so customers who intentionally rely on ##vso[ commands from remote machines keep working
# while we analyze real-world usage.
function Publish-VsoCommandInjectionDryRunTelemetry {
    param(
        [string] $source,
        [string] $text
    )
    try {
        if ([string]::IsNullOrEmpty($text)) { return }
        $occurrences = [regex]::Matches($text, '##vso\[')
        if ($occurrences.Count -eq 0) { return }
        # Capture only the command name (e.g. task.setvariable) using a restricted character set so
        # the telemetry payload can never itself contain a ##vso[ sequence or leak command values.
        $commandCounts = @{}
        foreach ($match in [regex]::Matches($text, '##vso\[([\w.]+)')) {
            $command = $match.Groups[1].Value
            if ($commandCounts.ContainsKey($command)) { $commandCounts[$command] = $commandCounts[$command] + 1 }
            else { $commandCounts[$command] = 1 }
        }
        $telemetryData = @{
            "Source" = $source;
            "TotalCount" = $occurrences.Count;
            "Commands" = $commandCounts;
        }
        $telemetryDataJson = ConvertTo-Json $telemetryData -Compress -Depth 5
        $telemetryDataJson = $telemetryDataJson.Replace([environment]::NewLine, '').Trim()
        Write-Verbose "VSO command injection dry-run telemetry: $telemetryDataJson"
        Write-Host "##vso[telemetry.publish area=TaskHub;feature=RemoteVsoCommandInjectionDryRun]$telemetryDataJson"
    } catch {
        Write-Verbose "Unable to publish VSO command injection dry-run telemetry. Error: $($_.Exception.Message)"
    }
}

# Override Write-ResponseLogs exported by the DTT module (Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal).
# Script-scope functions take precedence over module-exported functions in PowerShell command resolution,
# so this definition shadows the module's version for all call sites in this script. It preserves the
# original pass-through behavior (output is NOT modified) and only adds dry-run telemetry.
function Write-ResponseLogs {
    [CmdletBinding()]
    param(
        [string][Parameter(Mandatory=$true)] $operationName,
        [string][Parameter(Mandatory=$true)] $fqdn,
        [object][Parameter(Mandatory=$true)] $deploymentResponse
    )
    Write-Verbose "Finished $operationName operation on $fqdn"
    if (-not [string]::IsNullOrEmpty($deploymentResponse.DeploymentLog)) {
        Publish-VsoCommandInjectionDryRunTelemetry -source "PowerShellOnTargetMachinesV1:DeploymentLog" -text ($deploymentResponse.DeploymentLog | Out-String)
        Write-Output "Deployment logs for $operationName operation on $fqdn "
        Write-Output ($deploymentResponse.DeploymentLog | Format-List | Out-String)
    }
    if (-not [string]::IsNullOrEmpty($deploymentResponse.ServiceLog)) {
        Publish-VsoCommandInjectionDryRunTelemetry -source "PowerShellOnTargetMachinesV1:ServiceLog" -text ($deploymentResponse.ServiceLog | Out-String)
        Write-Verbose "Service logs for $operationName operation on $fqdn "
        Write-Verbose ($deploymentResponse.ServiceLog | Format-List | Out-String)
    }
}

# keep machineNames parameter name unchanged due to back compatibility
$machineFilter = $machineNames
$scriptPath = $scriptPath.Trim('"')
$initializationScriptPath = $initializationScriptPath.Trim('"')

# Getting resource tag key name for corresponding tag
$resourceFQDNKeyName = Get-ResourceFQDNTagKey
$resourceWinRMHttpPortKeyName = Get-ResourceHttpTagKey
$resourceWinRMHttpsPortKeyName = Get-ResourceHttpsTagKey

# Constants #
$useHttpProtocolOption = '-UseHttp'
$useHttpsProtocolOption = ''

$doSkipCACheckOption = '-SkipCACheck'
$doNotSkipCACheckOption = ''
$ErrorActionPreference = 'Stop'
$deploymentOperation = 'Deployment'

$envOperationStatus = "Passed"
$jobId = $env:SYSTEM_JOBID;

# enabling detailed logging only when system.debug is true
$enableDetailedLoggingString = $env:system_debug
if ($enableDetailedLoggingString -ne "true")
{
    $enableDetailedLoggingString = "false"
}

# Telemetry
Import-Module $PSScriptRoot\ps_modules\TelemetryHelper

function Publish-AzureTelemetry
 {
   param([object] $deploymentResponse, 
            [string] $jobId )
    if($deploymentResponse){
        $jsonString = -join("{")
        if([bool]($deploymentResponse.PSobject.Properties.name -match "IsAzureVm")){
            $jsonString = -join( $jsonString,
            "`"IsAzureVm`" : `"$($deploymentResponse.IsAzureVm)`"" ,
            ",")
        }
        if([bool]($deploymentResponse.PSobject.Properties.name -match "VmUuidHash")){
            $jsonString = -join( $jsonString,
            "`"VmUuidHash`" : `"$($deploymentResponse.VmUuidHash)`"",
            ",")
        }
        if([bool]($deploymentResponse.PSobject.Properties.name -match "TelemetryError")){
            $jsonString = -join( $jsonString,
            "`"TelemetryError`" : `"$($deploymentResponse.TelemetryError)`"",
            ",")
        }
    
        $jsonString = -join( $jsonString,
            "`"JobId`" : `"$jobId`"" , "}")
    }

    $telemetryString ="##vso[telemetry.publish area=TaskHub;feature=PowerShellOnTargetMachines]$jsonString"
    Write-Host $telemetryString
 }

try
{
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Write-Verbose "Starting Register-Environment cmdlet call for environment : $environmentName with filter $machineFilter"
    $environment = Register-Environment -EnvironmentName $environmentName -EnvironmentSpecification $environmentName -UserName $adminUserName -Password $adminPassword -WinRmProtocol $protocol -TestCertificate ($testCertificate -eq "true") -Connection $connection -TaskContext $distributedTaskContext -ResourceFilter $machineFilter
    Write-Verbose "Completed Register-Environment cmdlet call for environment : $environmentName"

    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName"
    $resources = Get-EnvironmentResources -Environment $environment

    if ($resources.Count -eq 0)
    {
        Write-Telemetry "Input_Validation" "No machine exists for given environment"
        throw (Get-LocalizedString -Key "No machine exists under environment: '{0}' for deployment" -ArgumentList $environmentName)
    }

    $resourcesPropertyBag = Get-ResourcesProperties -resources $resources
}
catch
{
    Write-Telemetry "Task_InternalError" $_.exception.Message

    throw
}

if($runPowershellInParallel -eq "false" -or  ( $resources.Count -eq 1 ) )
{
    foreach($resource in $resources)
    {
        $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
        $machine = $resourceProperties.fqdn
        $displayName = $resourceProperties.displayName
        Write-Output (Get-LocalizedString -Key "Deployment started for machine: '{0}'" -ArgumentList $displayName)

        $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $sessionVariables
        Write-ResponseLogs -operationName $deploymentOperation -fqdn $displayName -deploymentResponse $deploymentResponse
        $status = $deploymentResponse.Status

        Write-Output (Get-LocalizedString -Key "Deployment status for machine '{0}' : '{1}'" -ArgumentList $displayName, $status)
        Publish-AzureTelemetry -deploymentResponse $deploymentResponse -jobId $jobId

        if ($status -ne "Passed")
        {
            Write-Telemetry "DTLSDK_Error" $deploymentResponse.DeploymentSummary
            Write-Verbose $deploymentResponse.Error.ToString()
            $errorMessage =  $deploymentResponse.Error.Message
            throw $errorMessage
        }
    }
}
else
{
    [hashtable]$Jobs = @{} 
    $dtlsdkErrors = @()

    foreach($resource in $resources)
    {
        $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
        $machine = $resourceProperties.fqdn
        $displayName = $resourceProperties.displayName
        Write-Output (Get-LocalizedString -Key "Deployment started for machine: '{0}'" -ArgumentList $displayName)

        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $sessionVariables
        $Jobs.Add($job.Id, $resourceProperties)
    }
    While ($Jobs.Count -gt 0)
    {
         Start-Sleep 10 
         foreach($job in Get-Job)
         {
             if($Jobs.ContainsKey($job.Id) -and $job.State -ne "Running")
             {
                $output = Receive-Job -Id $job.Id
                Remove-Job $Job
                $status = $output.Status
                $displayName = $Jobs.Item($job.Id).displayName
                $resOperationId = $Jobs.Item($job.Id).resOperationId

                Write-ResponseLogs -operationName $deploymentOperation -fqdn $displayName -deploymentResponse $output
                Write-Output (Get-LocalizedString -Key "Deployment status for machine '{0}' : '{1}'" -ArgumentList $displayName, $status)
                Publish-AzureTelemetry -deploymentResponse $output -jobId $jobId
                
                if($status -ne "Passed")
                {
                    $envOperationStatus = "Failed"
                    $errorMessage = ""
                    if($output.Error -ne $null)
                    {
                        $errorMessage = $output.Error.Message
                    }
                    Write-Output (Get-LocalizedString -Key "Deployment failed on machine '{0}' with following message : '{1}'" -ArgumentList $displayName, $errorMessage)
                    $dtlsdkErrors += $output.DeploymentSummary
                }
                $Jobs.Remove($job.Id)
            }
        }
    }
}

if($envOperationStatus -ne "Passed")
{
    foreach ($error in $dtlsdkErrors) {
      Write-Telemetry "DTLSDK_Error" $error
    }
    
    $errorMessage = (Get-LocalizedString -Key 'Deployment on one or more machines failed.')
    throw $errorMessage
}

Write-Verbose "Leaving script PowerShellOnTargetMachines.ps1"
