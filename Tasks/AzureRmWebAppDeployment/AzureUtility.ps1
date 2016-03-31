$ErrorActionPreference = 'Stop'

function Get-AzureRMWebsite
{
    param([String][Parameter(Mandatory=$true)] $websiteName,
          [String][Parameter(Mandatory=$false)] $enableDetailedLoggingFlag)

    Write-Verbose "[Azure Call]Getting azureRM website:'$websiteName' details." -Verbose
    $azureRMWebSite = Get-AzureRMWebApp -Name $websiteName
    Write-Verbose "[Azure Call]Got azureRM website:'$websiteName' details." -Verbose

    if($enableDetailedLoggingFlag -eq "true")
    {
        Write-Verbose ($azureRMWebSite | Format-List | Out-String) -Verbose
    }

    return $azureRMWebSite
}

function Get-AzureRMWebsitePublishProfileObject
{
    param([String][Parameter(Mandatory=$true)] $websiteName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName,
          [String][Parameter(Mandatory=$false)] $enableDetailedLoggingFlag)

    $tmpFileName = [guid]::NewGuid().ToString()
    Write-Verbose "[Azure Call]Getting publish profile file for azureRM website:'$websiteName'" -Verbose
    $publishProfileContent = Get-AzureRMWebAppPublishingProfile -Name $websiteName -ResourceGroupName $resourceGroupName -OutputFile $tmpFileName
    Write-Verbose "[Azure Call]Got publish profile file for azureRM website:'$websiteName'" -Verbose

    Remove-Item -Path ".\$tmpFileName" -Force
    if($enableDetailedLoggingFlag -eq "true")
    {
        Write-Verbose $publishProfileContent -Verbose
    }

    # Converting publish profile content into object
    $publishProfileXML = [xml] $publishProfileContent
    $publishProfileObject = $publishProfileXML.publishData.publishProfile
    if($enableDetailedLoggingFlag -eq "true")
    {
        Write-Verbose ($publishProfileObject | Format-List | Out-String) -Verbose
    }

    return $publishProfileObject
}

function Get-AzureRMWebsiteConnectionDetails
{
    param([String][Parameter(Mandatory=$true)] $websiteName,
          [String][Parameter(Mandatory=$false)] $enableDetailedLoggingFlag)

    $azureRMWebsite = Get-AzureRMWebsite -websiteName $websiteName -enableDetailedLoggingFlag $enableDetailedLoggingFlag

    # Get kuduserver host name for azure website
    $kuduHostName = $azureRMWebSite.EnabledHostNames | Where-Object { $_ -like '*.scm.azurewebsites.net' } | Select-Object -First 1
    Write-Verbose "Related KuduHostName is :'$kuduHostName' for azureRM website: '$websiteName'" -Verbose

    # Get resourcegroup name under which azure website exists
    $azureRMWebsiteId = $azureRMWebSite.Id
    Write-Verbose "azureRMWebsite Id = $azureRMWebsiteId" -Verbose
    $resourceGroupName = $azureRMWebsiteId.Split('/')[4]
    Write-Verbose "Related resource group name is :'$resourceGroupName' for azureRM website: '$websiteName'" -Verbose

    # Get publish profile Data for azure website
    $publishProfileObject =  Get-AzureRMWebsitePublishProfileObject -websiteName $websiteName -resourceGroupName $resourceGroupName -enableDetailedLoggingFlag $enableDetailedLoggingFlag
    $webDeployProfile = $publishProfileObject | Where-Object {$_.publishUrl -like '*.scm.azurewebsites.net*'} | Select-Object -First 1

    # Get userName and userpassword for kuduServer
    $userName = $webDeployProfile.userName
    $userPassword = $webDeployProfile.userPWD

    $azureRMWebsiteConnectionDetails = @{}
    $azureRMWebsiteConnectionDetails.KuduHostName = $kuduHostName
    $azureRMWebsiteConnectionDetails.UserName = $userName
    $azureRMWebsiteConnectionDetails.UserPassword = $userPassword

    return $azureRMWebsiteConnectionDetails
}