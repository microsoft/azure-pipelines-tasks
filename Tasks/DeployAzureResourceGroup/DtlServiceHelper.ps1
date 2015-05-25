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
    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $subscriptionId)  
    $propertyBag.Add("SubscriptionId", $property)  

    #TODO Figure out authentication mechanism and store it
    $providerData = Register-ProviderData -Name $providerDataName -Type $providerDataType -ProviderName $providerName -PropertyBagValue $propertyBag -Connection $connection -ErrorAction Stop

    Write-Verbose "Registered provider data $providerData" -Verbose

    return $providerData
}

function Create-EnvironmentDefinition
{
    param([string]$environmentDefinitionName,
          [string]$providerName)
  
    Write-Verbose "Registering machine group definition $environmentDefinitionName" -Verbose

    $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
    $csmContent = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmFileContent)
    $propertyBag.Add("CsmContent", $csmContent)

    if ([string]::IsNullOrEmpty($csmParametersFile) -eq $false)
    {
        $csmParameters = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmParametersFileContent)
        $propertyBag.Add("CsmParameters", $csmParameters)
    }
    
    $environmentDefinition = Register-EnvironmentDefinition -Name $environmentDefinitionName -ProviderName $providerName -PropertyBagValue $propertyBag -Connection $connection -ErrorAction Stop

    Write-Verbose "Registered machine group definition $environmentDefinition" -Verbose

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
   
    Write-Verbose "Adding parameters to the machine group" -Verbose
    foreach($key in $azureResourceGroupDeployment.Parameters.Keys)
    {
        $propertyValue = $azureResourceGroupDeployment.Parameters.Item($key).Value
        if([string]::IsNullOrEmpty($propertyValue) -eq $false)
        {
            $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $propertyValue)
            $propertyBag.Add($key, $property)
        }
    }

    Write-Verbose "Adding tags to the machine group" -Verbose
    foreach($tagKey in $azureResourceGroup.Tags.Keys)
    {
        $tagValue = $azureResourceGroup.Tags.Item($tagKey)
        if([string]::IsNullOrEmpty($tagValue) -eq $false)
        {
            $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $tagValue)
            $propertyBag.Add($tagKey, $property)
        }
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
    
    $skipCACheckKey = "Microsoft-Vslabs-MG-SkipCACheck"
    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $skipCACheck)
    $propertyBag.Add($skipCACheckKey, $property)

    Write-Verbose -Verbose "Registering machine group $environmentName"
   
    $environment = Register-Environment -Name $environmentName -Type $environmentType -Status $environmentStatus -ProviderName $providerName -ProviderDataNames $providerDataNames -EnvironmentDefinitionName $environmentDefinitionName -PropertyBagValue $propertyBag -Resources $resources -Connection $connection -ErrorAction Stop

    Write-Host (Get-LocalizedString -Key "Registered machine group '{0}'" -ArgumentList $environment)

    return $environment
}

function Create-EnvironmentOperation
{
    param([Microsoft.VisualStudio.Services.DevTestLabs.Model.Environment]$environment)
    
    if($environment)
    {
        $name = $environment.Name

        $environmentPlatformId = $environment.Properties.GetProperty("PlatformId")
        $deploymentPlatformId = [System.String]::Format("{0}/{1}/{2}", $environmentPlatformId, "deployments", $environment.Name)
        $operationLogs = Get-AzureResourceGroupLog -ResourceGroup $environment.Name -StartTime $startTime -ErrorAction Stop
        $deploymentOperationLogs = $operationLogs | Where-Object {$_.ResourceId -eq $deploymentPlatformId}

        Write-Verbose "Saving machine group $name provisioning operation" -Verbose

        $operationStartTime = New-Object System.DateTime
        $operationEndTime = New-Object System.DateTime
        $operationStatus = "Unknown"

        if($deploymentOperationLogs)
        {
            $operationStartTime = $deploymentOperationLogs[$deploymentOperationLogs.Count - 1].EventTimestamp
            $operationEndTime = $deploymentOperationLogs[0].EventTimestamp
            $operationStatus = $deploymentOperationLogs[0].Status
        }
 
        $envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environment.Name -OperationName "CreateOrUpdate" -StartTime $operationStartTime -Connection $connection -ErrorAction Stop

        Create-ResourceOperations  -operationLogs $operationLogs -environment $environment -environmentOperationId $envOperationId

        #TODO: Pass pointer to build logs as operation logs
        Complete-EnvironmentOperation -EnvironmentName $environment.Name -EnvironmentOperationId $envOperationId -Status $operationStatus -EndTime $operationEndTime -Connection $connection -ErrorAction Stop

        Write-Verbose "Completed saving $name provisioning operation with id $envOperationId" -Verbose

        return $envOperationId
    }
}

function Create-ResourceOperations
{
    param([System.Array]$operationLogs,
          [Microsoft.VisualStudio.Services.DevTestLabs.Model.Environment]$environment,
          [guid]$environmentOperationId)

    if($environment -And $environmentOperationId)
    {
        foreach($resource in $environment.Resources)
        {
            $name = $resource.Name
            
            $resourcePlatformId = $resource.Properties.GetProperty("PlatformId")
            $resourceOperationLogs = $operationLogs | Where-Object {$_.ResourceId -like "*$resourcePlatformId*"}

            $operationStartTime = New-Object System.DateTime
            $operationEndTime = New-Object System.DateTime
            $operationStatus = "Unknown"

            if($resourceOperationLogs)
            {
                $operationStartTime = $resourceOperationLogs[$resourceOperationLogs.Count - 1].EventTimestamp
                $operationEndTime = $resourceOperationLogs[0].EventTimestamp
                $operationStatus = $resourceOperationLogs[0].Status
            }

            Write-Verbose "Saving resource $name provisioning operation" -Verbose

            $resOperationId = Invoke-ResourceOperation -EnvironmentName $environment.Name -ResourceName $resource.Name -StartTime $operationStartTime -EnvironmentOperationId $environmentOperationId -Connection $connection -ErrorAction Stop

            $logs = New-Object 'System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.Log]'
            Complete-ResourceOperation -EnvironmentName $environment.Name -EnvironmentOperationId $environmentOperationId -ResourceOperationId $resOperationId -Status $operationStatus -EndTime $operationEndTime -Logs $logs -Connection $connection -ErrorAction Stop

            Write-Verbose "Completed saving resource $name provisioning operation with id $resOperationId" -Verbose
        }
    }
}

function Check-EnvironmentNameAvailability
{
    param([string]$environmentName)

    if ([string]::IsNullOrEmpty($environmentName) -eq $false)
    {
        Write-Verbose -Verbose "Checking machine group name availability"

        $environment = Get-Environment -EnvironmentName $environmentName -Connection $connection -ErrorAction silentlycontinue

        if($environment)
        {
            if($environment.Provider.Name -ne "AzureResourceGroupManagerV2")
            {
                Throw "Machine Group with the name $environmentName is already registered. Please try a different name"
            }
        }

        Write-Host (Get-LocalizedString -Key "Checked machine group name availability")
    }
}

function Initialize-DTLServiceHelper
{
    Write-Verbose "Getting the vss connection object" -Verbose

    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Set-Variable -Name connection -Value $connection -Scope "Script"
}
