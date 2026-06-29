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

# Override Write-ResponseLogs exported by the DTT module (Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal).
# Original: Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal.psm1, function Write-ResponseLogs.
# Script-scope functions take precedence over module-exported functions in PowerShell command resolution,
# so this definition shadows the module's version for all call sites in this script.
#
# Why: The original Write-ResponseLogs outputs $deploymentResponse.DeploymentLog unsanitized via Write-Output.
# The agent scans pipeline output for ##vso[ prefix and executes matching lines as logging commands.
# A compromised remote VM can inject ##vso[task.setvariable] commands in its script output, which the
# DTT DLL collects into DeploymentLog. Without this override, those commands reach the agent and execute.
function Write-ResponseLogs {
    [CmdletBinding()]
    param(
        [string][Parameter(Mandatory=$true)] $operationName,
        [string][Parameter(Mandatory=$true)] $fqdn,
        [object][Parameter(Mandatory=$true)] $deploymentResponse
    )
    Write-Verbose "Finished $operationName operation on $fqdn"
    if (-not [string]::IsNullOrEmpty($deploymentResponse.DeploymentLog)) {
        Write-Output "Deployment logs for $operationName operation on $fqdn "
        Write-Output (($deploymentResponse.DeploymentLog | Format-List | Out-String) -replace '##vso\[', '##_vso[')
    }
    if (-not [string]::IsNullOrEmpty($deploymentResponse.ServiceLog)) {
        Write-Verbose "Service logs for $operationName operation on $fqdn "
        Write-Verbose (($deploymentResponse.ServiceLog | Format-List | Out-String) -replace '##vso\[', '##_vso[')
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
