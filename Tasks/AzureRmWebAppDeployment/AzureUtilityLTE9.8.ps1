# This file implements IAzureUtility for Azure PowerShell version <= 0.9.8

# returns azure webapp 
function Get-AzureRMWebAppARM
{
    param([String] [Parameter(Mandatory = $true)] $Name)

    Switch-AzureMode AzureResourceManager

    $resourceGroupName = Get-WebAppRGName -webAppName $Name

    Write-Verbose "[Azure Call] Getting azure webapp details for webapp with name : $Name and resource group $resourceGroupName "
    $azureWebApp =  Get-AzureWebApp -Name $webAppName -ResourceGroupName $resourceGroupName
    return $azureWebApp

}

function Get-WebAppRGName
{
    param([String] [Parameter(Mandatory = $true)] $webAppName)

    $ARMSqlServerResourceType =  "Microsoft.Web/sites"
    Switch-AzureMode AzureResourceManager

    try
    {
        Write-Verbose "[Azure Call] Getting resource details for webapp resource: $webAppName with resource type: $ARMSqlServerResourceType"
        $azureWebAppResourceDetails = (Get-AzureResource -ResourceName $webAppName -ErrorAction Stop) | Where-Object { $_.ResourceType -eq $ARMSqlServerResourceType }
        Write-Verbose "[Azure Call] Retrieved resource details successfully for webapp resource: $webAppName with resource type: $ARMSqlServerResourceType"

        $azureResourceGroupName = $azureWebAppResourceDetails.ResourceGroupName
        return $azureWebAppResourceDetails.ResourceGroupName
    }
    finally
    {
        if ([string]::IsNullOrEmpty($azureResourceGroupName))
        {
            Write-Verbose "[Azure Call] Web App: $webAppName not found"

            Throw (Get-LocalizedString -Key "Web App: '{0}' not found." -ArgumentList $webAppName)
        }
    }
}


function Construct-AzureWebAppConnectionObject
{
    param([String][Parameter(Mandatory=$true)] $kuduHostName,
          [Object][Parameter(Mandatory=$true)] $webAppProfileForMSDeploy)

    # Get userName and userPassword to access kuduServer
    $userName = $webAppProfileForMSDeploy.userName
    $userPassword = $webAppProfileForMSDeploy.UserPassword
    Write-Verbose "`t Username is:'$userName' to access KuduHostName:'$kuduHostName'."

    $azureRMWebAppConnectionDetails = @{}
    $azureRMWebAppConnectionDetails.KuduHostName = $kuduHostName
    $azureRMWebAppConnectionDetails.UserName = $userName
    $azureRMWebAppConnectionDetails.UserPassword = $userPassword

    return $azureRMWebAppConnectionDetails
}

function Get-AzureRMWebAppProfileForMSDeployWithProductionSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName)

    Switch-AzureMode AzureResourceManager

    Write-Verbose "`t [Azure Call]Getting publish profile file for azureRM WebApp:'$webAppName' under Production Slot."
    $webAppProfiles = Get-AzureWebAppPublishingProfile -Name $webAppName -ResourceGroupName $resourceGroupName
    Write-Verbose "`t [Azure Call]Got publish profile file for azureRM WebApp:'$webAppName' under Production Slot."

    $webAppProfileForMSDeploy = $webAppProfiles | Where-Object { $_.PublishMethod -eq 'MSDeploy'}

    return $webAppProfileForMSDeploy
}

function Get-AzureRMWebAppProfileForMSDeployWithSpecificSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName,
          [String][Parameter(Mandatory=$true)] $slotName)

    Switch-AzureMode AzureResourceManager

    Write-Verbose "`t [Azure Call]Getting publish profile file for azureRM WebApp:'$webAppName' under Slot:'$slotName'."
    $webAppProfiles = Get-AzureWebAppPublishingProfile -Name $webAppName -ResourceGroupName $resourceGroupName -Slot $slotName
    Write-Verbose "`t [Azure Call]Got publish profile file for azureRM WebApp:'$webAppName' under Slot:'$slotName'."

    $webAppProfileForMSDeploy = $webAppProfiles | Where-Object { $_.PublishMethod -eq 'MSDeploy'}

    return $webAppProfileForMSDeploy
}