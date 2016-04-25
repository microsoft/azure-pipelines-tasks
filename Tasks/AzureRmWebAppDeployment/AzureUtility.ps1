$ErrorActionPreference = 'Stop'

function Get-AzureUtility
{
    $currentVersion =  Get-AzureCmdletsVersion
    Write-Verbose  "Installed Azure PowerShell version: $currentVersion"

    $minimumAzureVersion = New-Object System.Version(0, 9, 9)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    $azureUtilityOldVersion = "AzureUtilityLTE9.8.ps1"
    $azureUtilityNewVersion = "AzureUtilityGTE1.0.ps1"

    if(!$versionCompatible)
    {
        $azureUtilityRequiredVersion = $azureUtilityOldVersion
    }
    else
    {
        $azureUtilityRequiredVersion = $azureUtilityNewVersion
    }

    Write-Verbose "Required AzureUtility: $azureUtilityRequiredVersion"
    return $azureUtilityRequiredVersion
}

function Get-AzureRMWebAppDetails
{
    param([String][Parameter(Mandatory=$true)] $webAppName)

    Write-Verbose "`t Getting azureRM WebApp:'$webAppName' details."
    $azureRMWebAppDetails = Get-AzureRMWebAppARM -Name $webAppName
    Write-Verbose "`t Got azureRM WebApp:'$webAppName' details."

    Write-Verbose ($azureRMWebAppDetails | Format-List | Out-String)
    return $azureRMWebAppDetails
}

function Get-AzureRMWebAppPublishUrl
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $deployToSlotFlag,
          [String][Parameter(Mandatory=$false)] $resourceGroupName,
          [String][Parameter(Mandatory=$false)] $slotName)

    Write-Verbose "`t Getting azureRM WebApp Url for web app :'$webAppName'."
    $AzureRMWebAppPublishUrl = Get-AzureRMWebAppPublishUrlARM -webAppName $WebAppName -deployToSlotFlag $DeployToSlotFlag `
                         -resourceGroupName $ResourceGroupName -slotName $SlotName
    Write-Verbose "`t Got azureRM azureRM WebApp Url for web app :'$webAppName'."

    Write-Verbose ($AzureRMWebAppPublishUrl | Format-List | Out-String)
    return $AzureRMWebAppPublishUrl
}

function Get-AzureRMWebAppConnectionDetailsWithSpecificSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName,
          [String][Parameter(Mandatory=$true)] $slotName)

    Write-Host (Get-LocalizedString -Key "Getting connection details for azureRM WebApp:'{0}' under Slot:'{1}'." -ArgumentList $webAppName, $slotName)

    $kuduHostName = $webAppName + "-" + $slotName + ".scm.azurewebsites.net"
    Write-Verbose "`t Using KuduHostName:'$kuduHostName' for azureRM WebApp:'$webAppName' under Slot:'$slotName'."

    # Get webApp publish profile Object for MSDeploy
    $webAppProfileForMSDeploy =  Get-AzureRMWebAppProfileForMSDeployWithSpecificSlot -webAppName $webAppName -resourceGroupName $resourceGroupName -slotName $slotName

    # construct object to store webApp connection details
    $azureRMWebAppConnectionDetailsWithSpecificSlot = Construct-AzureWebAppConnectionObject -kuduHostName $kuduHostName -webAppProfileForMSDeploy $webAppProfileForMSDeploy

    Write-Host (Get-LocalizedString -Key "Got connection details for azureRM WebApp:'{0}' under Slot:'{1}'." -ArgumentList $webAppName, $slotName)
    return $azureRMWebAppConnectionDetailsWithSpecificSlot
}

function Get-AzureRMWebAppConnectionDetailsWithProductionSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName)

    Write-Host (Get-LocalizedString -Key "Getting connection details for azureRM WebApp:'{0}' under Production Slot." -ArgumentList $webAppName)

    $kuduHostName = $webAppName + ".scm.azurewebsites.net"
    Write-Verbose  "`t Using KuduHostName:'$kuduHostName' for azureRM WebApp:'$webAppName' under default Slot."

    # Get azurerm webApp details
    $azureRMWebAppDetails = Get-AzureRMWebAppDetails -webAppName $webAppName

    if( $azureRMWebAppDetails.Count -eq 0 ){   
	   Throw (Get-LocalizedString -Key "WebApp '{0}' does not exist." -ArgumentList $webAppName)
    }

    # Get resourcegroup name under which azure webApp exists
    $azureRMWebAppId = $azureRMWebAppDetails.Id
    Write-Verbose "azureRMWebApp Id = $azureRMWebAppId"

    $resourceGroupName = $azureRMWebAppId.Split('/')[4]
    Write-Verbose "`t ResourceGroup name is:'$resourceGroupName' for azureRM WebApp:'$webAppName'."

    # Get webApp publish profile Object for MSDeploy
    $webAppProfileForMSDeploy =  Get-AzureRMWebAppProfileForMSDeployWithProductionSlot -webAppName $webAppName -resourceGroupName $resourceGroupName

    # construct object to store webApp connection details
    $azureRMWebAppConnectionDetailsWithProductionSlot = Construct-AzureWebAppConnectionObject -kuduHostName $kuduHostName -webAppProfileForMSDeploy $webAppProfileForMSDeploy

    Write-Host (Get-LocalizedString -Key "Got connection details for azureRM WebApp:'{0}' under Production Slot." -ArgumentList $webAppName)
    return $azureRMWebAppConnectionDetailsWithProductionSlot
}

function Get-AzureRMWebAppConnectionDetails
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $deployToSlotFlag,
          [String][Parameter(Mandatory=$false)] $resourceGroupName,
          [String][Parameter(Mandatory=$false)] $slotName)

    if($deployToSlotFlag -eq "true")
    {
        $azureRMWebAppConnectionDetails = Get-AzureRMWebAppConnectionDetailsWithSpecificSlot -webAppName $webAppName -resourceGroupName $ResourceGroupName -slotName $SlotName
    }
    else
    {
        $azureRMWebAppConnectionDetails = Get-AzureRMWebAppConnectionDetailsWithProductionSlot -webAppName $webAppName
    }

    return $azureRMWebAppConnectionDetails
}