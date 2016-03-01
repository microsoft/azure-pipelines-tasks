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

Write-Verbose "Entering script PowerShellOnTargetMachines.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "adminUserName = $adminUserName" -Verbose
Write-Verbose "protocol = $protocol" -Verbose
Write-Verbose "testCertificate = $testCertificate" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "scriptArguments = $scriptArguments" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose
Write-Verbose "runPowershellInParallel = $runPowershellInParallel" -Verbose
Write-Verbose "sessionVariables = $sessionVariables" -Verbose

. ./PowerShellJob.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

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
$telemetrySet = $false

# enabling detailed logging only when system.debug is true
$enableDetailedLoggingString = $env:system_debug
if ($enableDetailedLoggingString -ne "true")
{
    $enableDetailedLoggingString = "false"
}

# Telemetry

$telemetryCodes = 
@{
  "PREREQ_NoWinRMHTTP_Port" = "PREREQ001";
  "PREREQ_NoWinRMHTTPSPort" = "PREREQ002";
  "PREREQ_NoResources" = "PREREQ003";
  "PREREQ_NoOutputVariableForSelectActionInAzureRG" = "PREREQ004";
  "UNKNOWNPREDEP_Error" = "UNKNOWNPREDEP001";
  "DEPLOYMENT_Failed" = "DEP001";
  "AZUREPLATFORM_BlobUploadFailed" = "AZUREPLATFORM_BlobUploadFailed";
  "PREREQ_NoVMResources" = "PREREQ_NoVMResources";
  "UNKNOWNDEP_Error" = "UNKNOWNDEP_Error";
  "PREREQ_StorageAccountNotFound" = "PREREQ_StorageAccountNotFound";
  "AZUREPLATFORM_UnknownGetRMVMError" = "AZUREPLATFORM_UnknownGetRMVMError";
  "DEPLOYMENT_FetchPropertyFromMap" = "DEPLOYMENT_FetchPropertyFromMap";
  "PREREQ_UnsupportedAzurePSVerion" = "PREREQ_UnsupportedAzurePSVerion";
  "DEPLOYMENT_CSMDeploymentFailed" = "DEPLOYMENT_CSMDeploymentFailed";
  "PREREQ_InvalidServiceConnectionType" = "PREREQ_InvalidServiceConnectionType";
  "PREREQ_AzureRMModuleNotFound" = "PREREQ_AzureRMModuleNotFound";
  "PREREQ_InvalidFilePath" = "PREREQ_InvalidFilePath";
  "DEPLOYMENT_PerformActionFailed" = "DEPLOYMENT_PerformActionFailed"
 }

function Write-Telemetry
{
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$True,Position=1)]
    [string]$codeKey,

    [Parameter(Mandatory=$True,Position=2)]
    [string]$taskId
    )
  
  if($telemetrySet)
  {
    return
  }

  $code = $telemetryCodes[$codeKey]
  $telemetryString = "##vso[task.logissue type=error;code=" + $code + ";TaskId=" + $taskId + ";]"
  Write-Host $telemetryString
  $telemetrySet = $true
}

function Write-TaskSpecificTelemetry
{
    param(
      [string]$codeKey
      )
    Write-Telemetry "$codeKey" "3B5693D4-5777-4FEE-862A-BD2B7A374C68"
}

function ThrowError
{
    param([string]$errorMessage)
    
        $readmelink = "http://aka.ms/powershellontargetmachinesreadme"
        $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
        throw "$errorMessage $helpMessage"
}

function Get-ResourceWinRmConfig
{
    param
    (
        [string]$resourceName,
        [int]$resourceId
    )

    $resourceProperties = @{}

    $winrmPortToUse = ''
    $protocolToUse = ''


    if($protocol -eq "HTTPS")
    {
        $protocolToUse = $useHttpsProtocolOption
    
        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose
        $winrmPortToUse = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpsPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId (Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose
    
        if([string]::IsNullOrWhiteSpace($winrmPortToUse))
        {
            Write-TaskSpecificTelemetry "PREREQ_NoWinRMHTTPSPort"
            throw(Get-LocalizedString -Key "{0} port was not provided for resource '{1}'" -ArgumentList "WinRM HTTPS", $resourceName)
        }
    }
    elseif($protocol -eq "HTTP")
    {
        $protocolToUse = $useHttpProtocolOption
        
        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose
        $winrmPortToUse = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose
    
        if([string]::IsNullOrWhiteSpace($winrmPortToUse))
        {
            Write-TaskSpecificTelemetry "PREREQ_NoWinRMHTTPPort"
            throw(Get-LocalizedString -Key "{0} port was not provided for resource '{1}'" -ArgumentList "WinRM HTTP", $resourceName)
        }
    }

    elseif($environment.Provider -ne $null)      #  For standerd environment provider will be null
    {
        Write-Verbose "`t Environment is not standerd environment. Https port has higher precedence" -Verbose

        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose
        $winrmHttpsPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpsPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId (Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose

        if ([string]::IsNullOrEmpty($winrmHttpsPort))
        {
               Write-Verbose "`t Resource: $resourceName does not have any winrm https port defined, checking for winrm http port" -Verbose

               Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose
               $winrmHttpPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpPortKeyName -ResourceId $resourceId
               Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose

               if ([string]::IsNullOrEmpty($winrmHttpPort))
               {
                   Write-TaskSpecificTelemetry "PREREQ_NoWinRMHTTPPort"
                   throw(Get-LocalizedString -Key "Resource: '{0}' does not have WinRM service configured. Configure WinRM service on the Azure VM Resources. Refer for more details '{1}'" -ArgumentList $resourceName, "http://aka.ms/azuresetup" )
               }
               else
               {
                     # if resource has winrm http port defined
                     $winrmPortToUse = $winrmHttpPort
                     $protocolToUse = $useHttpProtocolOption
               }
        }
        else
        {
              # if resource has winrm https port opened
              $winrmPortToUse = $winrmHttpsPort
              $protocolToUse = $useHttpsProtocolOption
        }
   }
   else
   {
        Write-Verbose "`t Environment is standerd environment. Http port has higher precedence" -Verbose

        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose
        $winrmHttpPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose

        if ([string]::IsNullOrEmpty($winrmHttpPort))
        {
               Write-Verbose "`t Resource: $resourceName does not have any winrm http port defined, checking for winrm https port" -Verbose

               Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose
               $winrmHttpsPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpsPortKeyName -ResourceId $resourceId
               Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose

               if ([string]::IsNullOrEmpty($winrmHttpsPort))
               {
                   Write-TaskSpecificTelemetry "PREREQ_NoWinRMHTTPSPort"
                   throw(Get-LocalizedString -Key "Resource: '{0}' does not have WinRM service configured. Configure WinRM service on the Azure VM Resources. Refer for more details '{1}'" -ArgumentList $resourceName, "http://aka.ms/azuresetup" )
               }
               else
               {
                     # if resource has winrm https port defined
                     $winrmPortToUse = $winrmHttpsPort
                     $protocolToUse = $useHttpsProtocolOption
               }
        }
        else
        {
              # if resource has winrm http port opened
              $winrmPortToUse = $winrmHttpPort
              $protocolToUse = $useHttpProtocolOption
        }
   }

    $resourceProperties.protocolOption = $protocolToUse
    $resourceProperties.winrmPort = $winrmPortToUse

    return $resourceProperties;

}

function Get-SkipCACheckOption
{
    [CmdletBinding()]
    Param
    (
        [string]$environmentName
    )

    $skipCACheckOption = $doNotSkipCACheckOption
    $skipCACheckKeyName = Get-SkipCACheckTagKey

    # get skipCACheck option from environment
    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName" -Verbose
    $skipCACheckBool = Get-EnvironmentProperty -Environment $environment -Key $skipCACheckKeyName
    Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName" -Verbose

    if ($skipCACheckBool -eq "true")
    {
        $skipCACheckOption = $doSkipCACheckOption
    }

    return $skipCACheckOption
}

function Get-ResourceConnectionDetails
{
    param([object]$resource)

    $resourceProperties = @{}
    $resourceName = $resource.Name
    $resourceId = $resource.Id

    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose
    $fqdn = Get-EnvironmentProperty -Environment $environment -Key $resourceFQDNKeyName -ResourceId $resourceId
    Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose

    $winrmconfig = Get-ResourceWinRmConfig -resourceName $resourceName -resourceId $resourceId
    $resourceProperties.fqdn = $fqdn
    $resourceProperties.winrmPort = $winrmconfig.winrmPort
    $resourceProperties.protocolOption = $winrmconfig.protocolOption
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource
    $resourceProperties.displayName = $fqdn + ":" + $winrmconfig.winrmPort

    return $resourceProperties
}

function Get-ResourcesProperties
{
    param([object]$resources)

    $skipCACheckOption = Get-SkipCACheckOption -environmentName $environmentName
    [hashtable]$resourcesPropertyBag = @{}

    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        $resourceId = $resource.Id
        Write-Verbose "Get Resource properties for $resourceName (ResourceId = $resourceId)" -Verbose
        $resourceProperties = Get-ResourceConnectionDetails -resource $resource
        $resourceProperties.skipCACheckOption = $skipCACheckOption
        $resourcesPropertyBag.add($resourceId, $resourceProperties)
    }

    return $resourcesPropertyBag
}

try
{
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Write-Verbose "Starting Register-Environment cmdlet call for environment : $environmentName with filter $machineFilter" -Verbose
    $environment = Register-Environment -EnvironmentName $environmentName -EnvironmentSpecification $environmentName -UserName $adminUserName -Password $adminPassword -WinRmProtocol $protocol -TestCertificate ($testCertificate -eq "true") -Connection $connection -TaskContext $distributedTaskContext -ResourceFilter $machineFilter
    Write-Verbose "Completed Register-Environment cmdlet call for environment : $environmentName" -Verbose

    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName" -Verbose
    $resources = Get-EnvironmentResources -Environment $environment
    if ($resources.Count -eq 0)
    {
        Write-TaskSpecificTelemetry "PREREQ_NoResources"
        throw (Get-LocalizedString -Key "No machine exists under environment: '{0}' for deployment" -ArgumentList $environmentName)
    }

    $resourcesPropertyBag = Get-ResourcesProperties -resources $resources
}
catch
{
    if(-not $telemetrySet)
    {
        Write-TaskSpecificTelemetry "UNKNOWNPREDEP_Error"
    }

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

        if ($status -ne "Passed")
        {
            Write-TaskSpecificTelemetry "DEPLOYMENT_Failed"
            Write-Verbose $deploymentResponse.Error.ToString() -Verbose
            $errorMessage =  $deploymentResponse.Error.Message
            ThrowError -errorMessage $errorMessage
        }
    }
}
else
{
    [hashtable]$Jobs = @{} 

    foreach($resource in $resources)
    {
        $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
        $machine = $resourceProperties.fqdn
        $displayName = $resourceProperties.displayName
        Write-Output (Get-LocalizedString -Key "Deployment started for machine: '{0}'" -ArgumentList $displayName)

        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $sessionVariables
        $Jobs.Add($job.Id, $resourceProperties)
    }
    While (Get-Job)
    {
         Start-Sleep 10 
         foreach($job in Get-Job)
         {
             if($job.State -ne "Running")
             {
                $output = Receive-Job -Id $job.Id
                Remove-Job $Job
                $status = $output.Status
                $displayName = $Jobs.Item($job.Id).displayName
                $resOperationId = $Jobs.Item($job.Id).resOperationId

                Write-ResponseLogs -operationName $deploymentOperation -fqdn $displayName -deploymentResponse $output
                Write-Output (Get-LocalizedString -Key "Deployment status for machine '{0}' : '{1}'" -ArgumentList $displayName, $status)
                if($status -ne "Passed")
                {
                    $envOperationStatus = "Failed"
                    $errorMessage = ""
                    if($output.Error -ne $null)
                    {
                        $errorMessage = $output.Error.Message
                    }
                    Write-Output (Get-LocalizedString -Key "Deployment failed on machine '{0}' with following message : '{1}'" -ArgumentList $displayName, $errorMessage)
                }
            }
        }
    }
}

if($envOperationStatus -ne "Passed")
{
    Write-TaskSpecificTelemetry "DEPLOYMENT_Failed"
    $errorMessage = (Get-LocalizedString -Key 'Deployment on one or more machines failed.')
    ThrowError -errorMessage $errorMessage
}

Write-Verbose "Leaving script PowerShellOnTargetMachines.ps1" -Verbose
