# This file implements IAzureUtility for Azure PowerShell version >= 1.0.0

# returns azure webapp 
function Get-AzureRMWebAppARM
{
    param([String] [Parameter(Mandatory = $true)] $Name)

    Write-Verbose "[Azure Call] Getting azure webapp details for webapp with name : $Name "
    $azureWebApp =  Get-AzureRMWebApp -Name $Name

    if( $azureWebApp.Count -eq 0 ) 
    {
        Throw (Get-LocalizedString -Key "Web App: '{0}' not found." -ArgumentList $Name)
    }
    
    return $azureWebApp

}

function Get-AzureRMWebAppPublishUrlARM
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $deployToSlotFlag,
          [String][Parameter(Mandatory=$false)] $resourceGroupName,
          [String][Parameter(Mandatory=$false)] $slotName)

    if( $deployToSlotFlag -eq $false )
    {
        $resourceGroupName = Get-WebAppRGName -webAppName $webAppName
        Write-Verbose "Getting azure webapp info for webapp with name : $Name "
        $azureRMWebAppProfileDetails = Get-AzureRMWebAppProfileForMSDeployWithProductionSlot -webAppName $webAppName -resourceGroupName $resourceGroupName
        Write-Verbose "Got azure webapp info for webapp with name : $Name "
    }
    else
    {
        Write-Verbose "Getting azure webapp slot info for webapp with name : $Name , slot : $slotName and resource group : $resourceGroupName"
        $azureRMWebAppProfileDetails = Get-AzureRMWebAppProfileForMSDeployWithSpecificSlot -webAppName $webAppName -slotName $slotName -resourceGroupName $resourceGroupName
        Write-Verbose "Got azure webapp slot info for webapp with name : $Name , slot : $slotName and resource group : $resourceGroupName"
    }

    if( $azureRMWebAppProfileDetails -eq $null ){
        Throw (Get-LocalizedString -Key "Unable to find webapp publish profile details for webapp {0}." -ArgumentList $webAppName)
    }

    return $azureRMWebAppProfileDetails.destinationAppUrl
   
}

function Get-WebAppRGName
{
    param([String] [Parameter(Mandatory = $true)] $webAppName)

    $ARMSqlServerResourceType =  "Microsoft.Web/sites"

    try
    {
        Write-Verbose "[Azure Call] Getting resource details for webapp resource: $webAppName with resource type: $ARMSqlServerResourceType"
        $azureWebAppResourceDetails = (Get-AzureRmResource -ErrorAction Stop) | Where-Object { $_.ResourceType -eq $ARMSqlServerResourceType -and $_.ResourceName -eq $webAppName}
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

# return azure webapp publish profile
function Get-AzureRMWebAppPublishingProfileARM
{
    param([String] [Parameter(Mandatory = $true)] $Name,
          [String] [Parameter(Mandatory = $true)] $ResourceGroupName,
          [String] [Parameter(Mandatory = $true)] $pubXmlFile)

     Write-Verbose "[Azure Call] Getting webapp publish profile for azureRM webapp : $Name "
     $publishProfileContent = Get-AzureRMWebAppPublishingProfile -Name $Name -ResourceGroupName $resourceGroupName -OutputFile $pubXmlFile
     return $publishProfileContent

}


# return azure webapp slot publish profile 
function Get-AzureRMWebAppSlotPublishingProfileARM
{
    param([String] [Parameter(Mandatory = $true)] $Name,
          [String] [Parameter(Mandatory = $true)] $ResourceGroupName,
          [String] [Parameter(Mandatory = $true)] $slotName,
          [String] [Parameter(Mandatory = $true)] $pubXmlFile)

    Write-Verbose "[Azure Call] Getting publish profile file for azureRM WebApp:'$Name' for Slot:'$slotName'"
    $publishProfileContent = Get-AzureRMWebAppSlotPublishingProfile -Name $Name -ResourceGroupName $resourceGroupName -Slot $slotName -OutputFile $pubXmlFile
    return $publishProfileContent

}



function Construct-AzureWebAppConnectionObject
{
    param([String][Parameter(Mandatory=$true)] $kuduHostName,
          [Object][Parameter(Mandatory=$true)] $webAppProfileForMSDeploy)

    # Get userName and userPassword to access kuduServer
    $userName = $webAppProfileForMSDeploy.userName
    $userPassword = $webAppProfileForMSDeploy.userPWD
    Write-Verbose "`t Username is:'$userName' to access KuduHostName:'$kuduHostName'."

    $azureRMWebAppConnectionDetails = @{}
    $azureRMWebAppConnectionDetails.KuduHostName = $kuduHostName
    $azureRMWebAppConnectionDetails.UserName = $userName
    $azureRMWebAppConnectionDetails.UserPassword = $userPassword

    return $azureRMWebAppConnectionDetails
}

function Get-ProfileForMSDeployPublishMethod
{
    param([String][Parameter(Mandatory=$true)] $publishProfileContent)

    # Converting publish profile content into object
    $publishProfileXML = [xml] $publishProfileContent
    $publishProfileObject = $publishProfileXML.publishData.publishProfile

    # Getting profile for publish method 'MSDeploy'
    $webAppProfileForMSDeploy = $publishProfileObject | Where-Object {$_.publishMethod -eq 'MSDeploy'}

    return $webAppProfileForMSDeploy
}


function Get-AzureRMWebAppProfileForMSDeployWithProductionSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName)

    $currentDir = (Get-Item -Path ".\").FullName
    $tmpFileName = [guid]::NewGuid().ToString() + ".pubxml"
    $pubXmlFile = Join-Path $currentDir $tmpFileName

    Write-Verbose "`t [Azure Call]Getting publish profile file for azureRM WebApp:'$webAppName' under Production Slot at location: '$pubXmlFile'."
    $publishProfileContent = Get-AzureRMWebAppPublishingProfile -Name $webAppName -ResourceGroupName $resourceGroupName -OutputFile $pubXmlFile
    Write-Verbose "`t [Azure Call]Got publish profile file for azureRM WebApp:'$webAppName' under Production Slot at location: '$pubXmlFile'."

    Remove-Item -Path $pubXmlFile -Force
    Write-Verbose "`t Deleted publish profile file at location: '$pubXmlFile'"

    $webAppProfileForMSDeploy = Get-ProfileForMSDeployPublishMethod -publishProfileContent $publishProfileContent
    return $webAppProfileForMSDeploy
}

function Get-AzureRMWebAppProfileForMSDeployWithSpecificSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName,
          [String][Parameter(Mandatory=$true)] $slotName)

    $currentDir = (Get-Item -Path ".\").FullName
    $tmpFileName = [guid]::NewGuid().ToString() + ".pubxml"
    $pubXmlFile = Join-Path $currentDir $tmpFileName

    Write-Verbose "`t [Azure Call]Getting publish profile file for azureRM WebApp:'$webAppName' under Slot:'$slotName' at location: '$pubXmlFile'."
    $publishProfileContent = Get-AzureRMWebAppSlotPublishingProfile -Name $webAppName -ResourceGroupName $resourceGroupName -Slot $slotName -OutputFile $pubXmlFile
    Write-Verbose "`t [Azure Call]Got publish profile file for azureRM WebApp:'$webAppName' under Slot:'$slotName' at location: '$pubXmlFile'."

    Remove-Item -Path $pubXmlFile -Force
    Write-Verbose "`t Deleted publish profile file at location: '$pubXmlFile'"

    $webAppProfileForMSDeploy = Get-ProfileForMSDeployPublishMethod -publishProfileContent $publishProfileContent
    return $webAppProfileForMSDeploy
}
