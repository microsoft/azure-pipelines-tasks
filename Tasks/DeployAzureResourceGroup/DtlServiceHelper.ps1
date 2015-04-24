function Create-Provider
{
    param([string]$providerName,
          [string]$providerType)

    Write-Verbose "Registering provider $providerName" -Verbose

    $provider = Register-Provider -Name $providerName -Type $providerType -Connection $connection -ErrorAction Stop

    Write-Verbose "Registered provider $provider" -Verbose

    return $provider
}

function Create-ProviderData
{
    param([string]$providerName,
          [string]$providerDataName,
          [string]$providerDataType,
          [string]$subscriptionId)
    
    Write-Verbose "Registering provider data $providerDataName" -Verbose

    $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
    $subscriptionIdPropertyBagData = New-Object 'Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData' -ArgumentList $false, $subscriptionId
    $propertyBag.Add("SubscriptionId", $subscriptionIdPropertyBagData)

    #TODO Figure out authentication mechanism and store it
    $providerData = Register-ProviderData -Name $providerDataName -Type $providerDataType -ProviderName $providerName -PropertyBagValue $propertyBag -Connection $connection -ErrorAction Stop

    Write-Verbose "Registered provider data $providerData" -Verbose

    return $providerData
}

function Create-EnvironmentDefinition
{
    param([string]$environmentDefinitionName,
          [string]$providerName)
  
    Write-Verbose "Registering environment definition $environmentDefinitionName" -Verbose

    $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
    $csmContent = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmFileContent)
    $propertyBag.Add("CsmContent", $csmContent)

    if ([string]::IsNullOrEmpty($csmParametersFile) -eq $false)
    {
        $csmParameters = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmParametersFileContent)
        $propertyBag.Add("CsmParameters", $csmParameters)
    }

    $environmentDefinition = Register-EnvironmentDefinition -Name $environmentDefinitionName -ProviderName $providerName -PropertyBagValue $propertyBag -Connection $connection -ErrorAction Stop

    Write-Verbose "Registered environment definition $environmentDefinition" -Verbose

    return $environmentDefinition   
}

function Create-Environment
{
    param([string]$environmentName,
          [string]$environmentType,
          [string]$environmentStatus,
          [string]$providerName,
          [System.Collections.Generic.List[String]]$providerDataNames,
          [string]$environmentDefinitionName,          
          [System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2]]$resources)

    $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
   
    Write-Verbose "Adding parameters to the environment" -Verbose
    foreach($key in $azureResourceGroupDeployment.Parameters.Keys)
    {
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $azureResourceGroupDeployment.Parameters.Item($key).Value)
        $propertyBag.Add($key, $property)
    }

    Write-Verbose "Adding tags to the environment" -Verbose
    foreach($tagKey in $azureResourceGroup.Tags.Keys)
    {
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $resource.Tags.Item($tagKey))
        $propertyBag.Add($tagKey, $property)
    }

    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $azureResourceGroup.ResourceId)
    $propertyBag.Add("PlatformId", $property)

    if ($vmCreds -eq "true")
    {
        $usernameTagKey = "Microsoft-Vslabs-MG-Resource-Username"
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $vmUserName)
        $propertyBag.Add($usernameTagKey, $property)

        $passwordTagKey = "Microsoft-Vslabs-MG-Resource-Password"
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($true, $vmPassword)
        $propertyBag.Add($passwordTagKey, $property)
    }
    
    Write-Verbose "Registering environment $environmentName" -Verbose

    $environment = Register-Environment -Name $environmentName -Type $environmentType -Status $environmentStatus -ProviderName $providerName -ProviderDataNames $providerDataNames -EnvironmentDefinitionName $environmentDefinitionName -PropertyBagValue $propertyBag -Resources $resources -Connection $connection -ErrorAction Stop

    Write-Verbose "Registered environment $environment" -Verbose

    return $environment
}

function Create-EnvironmentOperation
{
    param([Microsoft.VisualStudio.Services.DevTestLabs.Model.Environment]$environment)
    
    if($environment)
    {
        $name = $environment.Name

        Write-Verbose "Saving resource group creation logs" -Verbose

        $environmentPlatformId = $environment.Properties.GetProperty("PlatformId")
        $deploymentPlatformId = [System.String]::Format("{0}/{1}/{2}", $environmentPlatformId, "deployments", $environment.Name)
        $deploymentOperationLogs = Get-AzureResourceLog -ResourceId $deploymentPlatformId -StartTime $startTime -Detailed -ErrorAction Stop
        $logs = Get-OperationLogs -operationLogs $deploymentOperationLogs

        Write-Verbose "Saving environment $name provisioning operation" -Verbose

        $operationStartTime = New-Object System.DateTime
        $operationEndTime = New-Object System.DateTime
        $operationStatus = "Unknown"

        if(!$deploymentOperationLogs)
        {
            $operationStartTime = $deploymentOperationLogs[$deploymentOperationLogs.Count - 1].SubmissionTimestamp
            $operationEndTime = $deploymentOperationLogs[0].SubmissionTimestamp
            $operationStatus = $deploymentOperationLogs[0].Status
        }

        $envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environment.Name -OperationName "CreateOrUpdate" -StartTime $operationStartTime -Connection $connection -ErrorAction Stop

        Create-ResourceOperations -environment $environment -environmentOperationId $envOperationId

        Complete-EnvironmentOperation -EnvironmentName $environment.Name -EnvironmentOperationId $envOperationId -Status $operationStatus -EndTime $operationEndTime -Logs $logs -Connection $connection -ErrorAction Stop

        Write-Verbose "Completed saving $name provisioning operation with id $envOperationId" -Verbose

        return $envOperationId
    }
}

function Create-ResourceOperations
{
    param([Microsoft.VisualStudio.Services.DevTestLabs.Model.Environment]$environment,
          [guid]$environmentOperationId)

    if($environment -And $environmentOperationId)
    {
        foreach($resource in $environment.Resources)
        {
            $name = $resource.Name
            
            Write-Verbose "Saving resource creation logs" -Verbose

            $resourcePlatformId = $resource.Properties.GetProperty("PlatformId")
            $resourceOperationLogs = Get-AzureResourceLog -ResourceId $resourcePlatformId -StartTime $startTime -Detailed -ErrorAction Stop
            $logs = Get-OperationLogs -operationLogs $resourceOperationLogs

            $operationStartTime = New-Object System.DateTime
            $operationEndTime = New-Object System.DateTime
            $operationStatus = "Unknown"

            if(!$logs)
            {
                $operationStartTime = $deploymentOperationLogs[$deploymentOperationLogs.Count - 1].SubmissionTimestamp
                $operationEndTime = $deploymentOperationLogs[0].SubmissionTimestamp
                $operationStatus = $deploymentOperationLogs[0].Status
            }

            Write-Verbose "Saving resource $name provisioning operation" -Verbose

            $resOperationId = Invoke-ResourceOperation -EnvironmentName $environment.Name -ResourceName $resource.Name -StartTime $operationStartTime -EnvironmentOperationId $environmentOperationId -Connection $connection -ErrorAction Stop

            Complete-ResourceOperation -EnvironmentName $environment.Name -EnvironmentOperationId $environmentOperationId -ResourceOperationId $resOperationId -Status $operationStatus -EndTime $operationEndTime -Logs $logs -Connection $connection -ErrorAction Stop

            Write-Verbose "Completed saving resource $name provisioning operation with id $resOperationId" -Verbose
        }
    }
}

function Get-OperationLogs
{
    param([System.Array]$operationLogs)

    $logs = New-Object 'System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.Log]'

    foreach($log in $operationLogs)
    {                
        $logContent = [System.String]::Format("{0} {1} with message:{2}", $log.OperationName, $log.Status, $log.Properties)
        $operationLog = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.Log
        $operationLog.Content = $logContent
        $operationLog.CreatedTime = $log.SubmissionTimestamp
        $operationLog.Level = $log.Level
        $logs.Add($operationLog)
    }
        
    return $logs
}

function Check-EnvironmentNameAvailability
{
    param([string]$environmentName)

    if ([string]::IsNullOrEmpty($environmentName) -eq $false)
    {
        Write-Verbose "Checking environment name availability" -Verbose

        $environment = Get-Environment -EnvironmentName $environmentName -Connection $connection -ErrorAction silentlycontinue

        if($environment)
        {
            if($environment.Provider.Name -ne "AzureResourceGroupManagerV2")
            {
                Throw "Environment with the name $environmentName is already registered. Please try a different name"
            }
        }

        Write-Verbose "Checked environment name availability" -Verbose
    }
}

function Initialize-DTLServiceHelper
{
    Write-Verbose "Getting the vss connection object" -Verbose

    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Set-Variable -Name connection -Value $connection -Scope "Script"
}
