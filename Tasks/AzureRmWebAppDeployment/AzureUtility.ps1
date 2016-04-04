$ErrorActionPreference = 'Stop'

function Get-AzureRMWebsite
{
    param([String][Parameter(Mandatory=$true)] $websiteName)

    Write-Verbose "[Azure Call]Getting azureRM website:'$websiteName' details." -Verbose
    $azureRMWebSite = Get-AzureRMWebApp -Name $websiteName
    Write-Verbose "[Azure Call]Got azureRM website:'$websiteName' details." -Verbose

    Write-Verbose ($azureRMWebSite | Format-List | Out-String) -Verbose
    return $azureRMWebSite
}

function Get-AzureRMWebsitePublishProfileObject
{
    param([String][Parameter(Mandatory=$true)] $websiteName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName)

    $currentDir = (Get-Item -Path ".\" -Verbose).FullName
    $tmpFileName = [guid]::NewGuid().ToString() + ".pubxml"
    $pubXmlFile = Join-Path $currentDir $tmpFileName

    $publishProfileContent = Get-AzureRMWebAppPublishingProfile -Name $websiteName -ResourceGroupName $resourceGroupName -OutputFile $pubXmlFile
    Write-Verbose "[Azure Call]Got publish profile file for azureRM website:'$websiteName' at location: '$pubXmlFile'" -Verbose

    Write-Verbose "Deleting publish profile file at location: '$pubXmlFile'" -Verbose
    Remove-Item -Path $pubXmlFile -Force
    Write-Verbose "Deleted publish profile file at location: '$pubXmlFile'" -Verbose

    # Converting publish profile content into object
    $publishProfileXML = [xml] $publishProfileContent
    $publishProfileObject = $publishProfileXML.publishData.publishProfile

    return $publishProfileObject
}

function Get-AzureRMWebsiteConnectionDetails
{
    param([String][Parameter(Mandatory=$true)] $websiteName)

    Write-Verbose "Getting connection details for azureRM website: '$websiteName'" -Verbose

    # Get azurerm website details
    $azureRMWebsite = Get-AzureRMWebsite -websiteName $websiteName

    # Get kuduserver host name for azure website
    $kuduHostName = $azureRMWebSite.EnabledHostNames | Where-Object { $_ -like '*.scm.azurewebsites.net' } | Select-Object -First 1
    Write-Verbose "Related KuduHostName is: '$kuduHostName' for azureRM website: '$websiteName'" -Verbose

    # Get resourcegroup name under which azure website exists
    $azureRMWebsiteId = $azureRMWebSite.Id
    Write-Verbose "azureRMWebsite Id = $azureRMWebsiteId" -Verbose
    $resourceGroupName = $azureRMWebsiteId.Split('/')[4]
    Write-Verbose "Related resource group name is: '$resourceGroupName' for azureRM website: '$websiteName'" -Verbose

    # Get publish profile Data for azure website
    $publishProfileObject =  Get-AzureRMWebsitePublishProfileObject -websiteName $websiteName -resourceGroupName $resourceGroupName
    $webDeployProfile = $publishProfileObject | Where-Object {$_.publishUrl -like '*.scm.azurewebsites.net*'} | Select-Object -First 1

    # Get userName and userpassword for kuduServer
    $userName = $webDeployProfile.userName
    $userPassword = $webDeployProfile.userPWD
    Write-Verbose "Related username is: '$resourceGroupName' to access KuduHostName: '$kuduHostName'" -Verbose

    $azureRMWebsiteConnectionDetails = @{}
    $azureRMWebsiteConnectionDetails.KuduHostName = $kuduHostName
    $azureRMWebsiteConnectionDetails.UserName = $userName
    $azureRMWebsiteConnectionDetails.UserPassword = $userPassword

    Write-Verbose "Got connection details for azureRM website: '$websiteName'" -Verbose
    return $azureRMWebsiteConnectionDetails
}