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

# enabling detailed logging only when system.debug is true
$enableDetailedLoggingString = $env:system_debug
if ($enableDetailedLoggingString -ne "true")
{
    $enableDetailedLoggingString = "false"
}

# Telemetry
Import-Module $PSScriptRoot\ps_modules\TelemetryHelper

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
    
        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName"
        $winrmPortToUse = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpsPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId (Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName"
    
        if([string]::IsNullOrWhiteSpace($winrmPortToUse))
        {
            Write-Telemetry "Input_Validation" "WinRM HTTPS port not provided"
            throw(Get-LocalizedString -Key "{0} port was not provided for resource '{1}'" -ArgumentList "WinRM HTTPS", $resourceName)
        }
    }
    elseif($protocol -eq "HTTP")
    {
        $protocolToUse = $useHttpProtocolOption
        
        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName"
        $winrmPortToUse = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName"
    
        if([string]::IsNullOrWhiteSpace($winrmPortToUse))
        {
            Write-Telemetry "Input_Validation" "WinRM HTTP port not provided"
            throw(Get-LocalizedString -Key "{0} port was not provided for resource '{1}'" -ArgumentList "WinRM HTTP", $resourceName)
        }
    }

    elseif($environment.Provider -ne $null)      #  For standard environment provider will be null
    {
        Write-Verbose "`t Environment is not standard environment. Https port has higher precedence"

        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName"
        $winrmHttpsPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpsPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId (Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName"

        if ([string]::IsNullOrEmpty($winrmHttpsPort))
        {
               Write-Verbose "`t Resource: $resourceName does not have any winrm https port defined, checking for winrm http port"

               Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName"
               $winrmHttpPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpPortKeyName -ResourceId $resourceId
               Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName"

               if ([string]::IsNullOrEmpty($winrmHttpPort))
               {
                   Write-Telemetry "Input_Validation" "WinRM port not available"
                   throw(Get-LocalizedString -Key "Resource: '{0}' does not have WinRM service configured. Configure WinRM service on the Azure VM Resources. Refer for more details '{1}'" -ArgumentList $resourceName, "https://aka.ms/azuresetup" )
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
        Write-Verbose "`t Environment is standard environment. Http port has higher precedence"
        
        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName"
        $winrmHttpPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpPortKeyName -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName"

        if ([string]::IsNullOrEmpty($winrmHttpPort))
        {
               Write-Verbose "`t Resource: $resourceName does not have any winrm http port defined, checking for winrm https port"

               Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName"
               $winrmHttpsPort = Get-EnvironmentProperty -Environment $environment -Key $resourceWinRMHttpsPortKeyName -ResourceId $resourceId
               Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName"

               if ([string]::IsNullOrEmpty($winrmHttpsPort))
               {
                   Write-Telemetry "Input_Validation" "WinRM port not available"
                   throw(Get-LocalizedString -Key "Resource: '{0}' does not have WinRM service configured. Configure WinRM service on the Azure VM Resources. Refer for more details '{1}'" -ArgumentList $resourceName, "https://aka.ms/azuresetup" )
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
    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName"
    $skipCACheckBool = Get-EnvironmentProperty -Environment $environment -Key $skipCACheckKeyName
    Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName"

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

    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName"
    $fqdn = Get-EnvironmentProperty -Environment $environment -Key $resourceFQDNKeyName -ResourceId $resourceId
    Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName"

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
        Write-Verbose "Get Resource properties for $resourceName (ResourceId = $resourceId)"
        $resourceProperties = Get-ResourceConnectionDetails -resource $resource
        $resourceProperties.skipCACheckOption = $skipCACheckOption
        $resourcesPropertyBag.add($resourceId, $resourceProperties)
    }

    return $resourcesPropertyBag
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
