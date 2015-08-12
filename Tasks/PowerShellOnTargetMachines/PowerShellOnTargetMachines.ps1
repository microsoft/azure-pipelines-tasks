param (
    [string]$environmentName,
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

function ThrowError
{
	param([string]$errorMessage)
	
        $readmelink = "https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/PowerShellOnTargetMachines/README.md"
        $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
        throw "$errorMessage $helpMessage"
}

function Get-ResourceWinRmConfig
{
    param([string]$resourceName)

    $resourceProperties = @{}

    $winrmPortToUse = ''
    $protocolToUse = ''

    Write-Verbose "Starting Get-Environment cmdlet call on environment name: $environmentName" -Verbose
    $environment = Get-Environment -environmentName $environmentName -Connection $connection
    Write-Verbose "Completed Get-Environment cmdlet call on environment name: $environmentName" -Verbose

    if($environment.Provider -ne $null)      #  For standerd environment provider will be null
    {
        Write-Verbose "`t Environment is not standerd environment. Https port has higher precedence" -Verbose

        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpsPortKeyName" -Verbose
        $winrmHttpsPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceName $resourceName
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpsPortKeyName" -Verbose

        if ([string]::IsNullOrEmpty($winrmHttpsPort))
        {
               Write-Verbose "`t Resource: $resourceName does not have any winrm https port defined, checking for winrm http port" -Verbose

               Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpPortKeyName" -Verbose
               $winrmHttpPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName
               Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpPortKeyName" -Verbose

               if ([string]::IsNullOrEmpty($winrmHttpPort))
               {
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

        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpPortKeyName" -Verbose
        $winrmHttpPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpPortKeyName" -Verbose

        if ([string]::IsNullOrEmpty($winrmHttpPort))
        {
               Write-Verbose "`t Resource: $resourceName does not have any winrm http port defined, checking for winrm https port" -Verbose

               Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpsPortKeyName" -Verbose
               $winrmHttpsPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceName $resourceName
               Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpsPortKeyName" -Verbose

               if ([string]::IsNullOrEmpty($winrmHttpsPort))
               {
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
        [string]$environmentName,
        [Microsoft.VisualStudio.Services.Client.VssConnection]$connection
    )

    $skipCACheckOption = $doNotSkipCACheckOption
    $skipCACheckKeyName = Get-SkipCACheckTagKey

    # get skipCACheck option from environment
    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName" -Verbose
    $skipCACheckBool = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $skipCACheckKeyName -Connection $connection
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

    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceFQDNKeyName" -Verbose
    $fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceName $resourceName
    Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceFQDNKeyName" -Verbose

    $winrmconfig = Get-ResourceWinRmConfig -resourceName $resourceName
    $resourceProperties.fqdn = $fqdn
    $resourceProperties.winrmPort = $winrmconfig.winrmPort
    $resourceProperties.protocolOption = $winrmconfig.protocolOption
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource	

    return $resourceProperties
}

function Get-ResourcesProperties
{
    param([object]$resources)

    $skipCACheckOption = Get-SkipCACheckOption -environmentName $environmentName -connection $connection
    [hashtable]$resourcesPropertyBag = @{}

    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        Write-Verbose "Get Resource properties for $resourceName " -Verbose
        $resourceProperties = Get-ResourceConnectionDetails -resource $resource
        $resourceProperties.skipCACheckOption = $skipCACheckOption
        $resourcesPropertyBag.add($resourceName, $resourceProperties)
    }

    return $resourcesPropertyBag
}

function Get-WellFormedTagsList
{
    [CmdletBinding()]
    Param
    (
        [string]$tagsListString
    )

    if([string]::IsNullOrWhiteSpace($tagsListString))
    {
        return $null
    }

    $tagsArray = $tagsListString.Split(';')
    $tagList = New-Object 'System.Collections.Generic.List[Tuple[string,string]]'
    foreach($tag in $tagsArray)
    {
        if([string]::IsNullOrWhiteSpace($tag)) {continue}
        $tagKeyValue = $tag.Split(':')
        if($tagKeyValue.Length -ne 2)
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        if([string]::IsNullOrWhiteSpace($tagKeyValue[0]) -or [string]::IsNullOrWhiteSpace($tagKeyValue[1]))
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        $tagTuple = New-Object "System.Tuple[string,string]" ($tagKeyValue[0].Trim(), $tagKeyValue[1].Trim())
        $tagList.Add($tagTuple) | Out-Null
    }

    $tagList = [System.Collections.Generic.IEnumerable[Tuple[string,string]]]$tagList
    return ,$tagList
}

$connection = Get-VssConnection -TaskContext $distributedTaskContext

if($resourceFilteringMethod -eq "tags")
{
    $wellFormedTagsList = Get-WellFormedTagsList -tagsListString $machineFilter

    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with tag filter: $wellFormedTagsList" -Verbose
    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -TagFilter $wellFormedTagsList -Connection $connection
    Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with tag filter" -Verbose
}
else
{
    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with machine filter: $machineFilter" -Verbose
    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineFilter -Connection $connection
    Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with machine filter" -Verbose
}

if ($resources.Count -eq 0)
{
    throw (Get-LocalizedString -Key "No machine exists under environment: '{0}' for deployment" -ArgumentList $environmentName)
}

Write-Verbose "Starting Invoke-EnvironmentOperation cmdlet call on environment name: $environmentName with operation name: $deploymentOperation" -Verbose
$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName $deploymentOperation -Connection $connection
Write-Verbose "Completed Invoke-EnvironmentOperation cmdlet call on environment name: $environmentName with operation name: $deploymentOperation" -Verbose
Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose

$resourcesPropertyBag = Get-ResourcesProperties -resources $resources

$parsedSessionVariables = Get-ParsedSessionVariables -inputSessionVariables $sessionVariables

if($runPowershellInParallel -eq "false" -or  ( $resources.Count -eq 1 ) )
{
    foreach($resource in $resources)
    {
        $resourceProperties = $resourcesPropertyBag.Item($resource.Name)
        $machine = $resourceProperties.fqdn
        Write-Output (Get-LocalizedString -Key "Deployment started for machine: '{0}'" -ArgumentList $machine)

        Write-Verbose "Starting Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $($resource.Name) and environment operationId: $envOperationId" -Verbose
        $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
        Write-Verbose "Completed Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $($resource.Name) and environment operationId: $envOperationId" -Verbose
        Write-Verbose "ResourceOperationId = $resOperationId" -Verbose

        $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $parsedSessionVariables 
        Write-ResponseLogs -operationName $deploymentOperation -fqdn $machine -deploymentResponse $deploymentResponse
        $status = $deploymentResponse.Status

        Write-Output (Get-LocalizedString -Key "Deployment status for machine '{0}' : '{1}'" -ArgumentList $machine, $status)

        # getting operation logs
        $logs = Get-OperationLogs
        Write-Verbose "Upload BuildUri $logs as operation logs." -Verbose

        Write-Verbose "Starting Complete-ResourceOperation cmdlet call on resource: $($resource.Name) with resource operationId: $resOperationId" -Verbose
        Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $deploymentResponse.Status -ErrorMessage $deploymentResponse.Error -Logs $logs -Connection $connection
        Write-Verbose "Completed Complete-ResourceOperation cmdlet call on resource: $($resource.Name) with resource operationId: $resOperationId" -Verbose

        if ($status -ne "Passed")
        {
            Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: Failed" -Verbose
            Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection
            Write-Verbose "Completed Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: Failed" -Verbose

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
        $resourceProperties = $resourcesPropertyBag.Item($resource.Name)
        $machine = $resourceProperties.fqdn
        Write-Output (Get-LocalizedString -Key "Deployment started for machine: '{0}'" -ArgumentList $machine)

        Write-Verbose "Starting Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $($resource.Name) and environment operationId: $envOperationId" -Verbose
        $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
        Write-Verbose "Completed Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $($resource.Name) and environment operationId: $envOperationId" -Verbose
        Write-Verbose "ResourceOperationId = $resOperationId" -Verbose

        $resourceProperties.resOperationId = $resOperationId
        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $parsedSessionVariables
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
                $machineName = $Jobs.Item($job.Id).fqdn
                $resOperationId = $Jobs.Item($job.Id).resOperationId

                Write-ResponseLogs -operationName $deploymentOperation -fqdn $machineName -deploymentResponse $output
                Write-Output (Get-LocalizedString -Key "Deployment status for machine '{0}' : '{1}'" -ArgumentList $machineName, $status)
                if($status -ne "Passed")
                {
                    $envOperationStatus = "Failed"
                    $errorMessage = ""
                    if($output.Error -ne $null)
                    {
                        $errorMessage = $output.Error.Message
                    }
                    Write-Output (Get-LocalizedString -Key "Deployment failed on machine '{0}' with following message : '{1}'" -ArgumentList $machineName, $errorMessage)
                }
                # getting operation logs
                $logs = Get-OperationLogs
                Write-Verbose "Upload BuildUri $logs as operation logs." -Verbose

                Write-Verbose "Starting Complete-ResourceOperation cmdlet call on environment name: $environmentName with resource operationId: $resOperationId" -Verbose
                Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $output.Status -ErrorMessage $output.Error -Logs $logs -Connection $connection
                Write-Verbose "Completed Complete-ResourceOperation cmdlet call on environment name: $environmentName with resource operationId: $resOperationId" -Verbose
            }
        }
    }
}

Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose
Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop
Write-Verbose "Completed Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose

if($envOperationStatus -ne "Passed")
{
    $errorMessage = (Get-LocalizedString -Key 'Deployment on one or more machines failed.')
    ThrowError -errorMessage $errorMessage
}

Write-Verbose "Leaving script PowerShellOnTargetMachines.ps1" -Verbose
