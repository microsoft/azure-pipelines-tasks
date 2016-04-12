$ErrorActionPreference = 'Stop'

function Get-AzureRMWebAppDetails
{
    param([String][Parameter(Mandatory=$true)] $webAppName)

    Write-Host (Get-LocalizedString -Key "`t [Azure Call]Getting azureRM WebApp:'{0}' details." -ArgumentList $webAppName)
    $azureRMWebAppDetails = Get-AzureRMWebApp -Name $webAppName
    Write-Host (Get-LocalizedString -Key "`t [Azure Call]Got azureRM WebApp:'{0}' details." -ArgumentList $webAppName)

    Write-Verbose ($azureRMWebAppDetails | Format-List | Out-String)
    return $azureRMWebAppDetails
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

function Get-AzureRMWebAppProfileForMSDeployWithDefaultSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName)

    $currentDir = (Get-Item -Path ".\").FullName
    $tmpFileName = [guid]::NewGuid().ToString() + ".pubxml"
    $pubXmlFile = Join-Path $currentDir $tmpFileName

    Write-Host (Get-LocalizedString -Key "`t [Azure Call]Getting publish profile file for azureRM WebApp:'{0}'." -ArgumentList $webAppName)
    $publishProfileContent = Get-AzureRMWebAppPublishingProfile -Name $webAppName -ResourceGroupName $resourceGroupName -OutputFile $pubXmlFile
    Write-Host (Get-LocalizedString -Key "`t [Azure Call]Got publish profile file for azureRM WebApp:'{0}'." -ArgumentList $webAppName)

    Remove-Item -Path $pubXmlFile -Force
    Write-Verbose "`t Deleted publish profile file at location: '$pubXmlFile'"

    $webAppProfileForMSDeploy = Get-ProfileForMSDeployPublishMethod -publishProfileContent $publishProfileContent
    return $webAppProfileForMSDeploy
}

function Get-AzureRMWebAppProfileForMSDeployWithSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName,
          [String][Parameter(Mandatory=$true)] $slotName)

    $currentDir = (Get-Item -Path ".\").FullName
    $tmpFileName = [guid]::NewGuid().ToString() + ".pubxml"
    $pubXmlFile = Join-Path $currentDir $tmpFileName

    Write-Host (Get-LocalizedString -Key "`t [Azure Call]Getting publish profile file for azureRM WebApp:'{0}' under Slot:'{1}'." -ArgumentList $webAppName, $slotName)
    $publishProfileContent = Get-AzureRMWebAppSlotPublishingProfile -Name $webAppName -ResourceGroupName $resourceGroupName -Slot $slotName -OutputFile $pubXmlFile
    Write-Host (Get-LocalizedString -Key "`t [Azure Call]Got publish profile file for azureRM WebApp:'{0}' under Slot:'{1}'." -ArgumentList $webAppName, $slotName)

    Remove-Item -Path $pubXmlFile -Force
    Write-Verbose "`t Deleted publish profile file at location: '$pubXmlFile'"

    $webAppProfileForMSDeploy = Get-ProfileForMSDeployPublishMethod -publishProfileContent $publishProfileContent
    return $webAppProfileForMSDeploy
}

function Construct-AzureWebAppConnectionObject
{
    param([String][Parameter(Mandatory=$true)] $kuduHostName,
          [Object][Parameter(Mandatory=$true)] $webAppProfileForMSDeploy)

    # Get userName and userPassword to access kuduServer
    $userName = $webAppProfileForMSDeploy.userName
    $userPassword = $webAppProfileForMSDeploy.userPWD
    Write-Host (Get-LocalizedString -Key "`t Username is:'{0}' to access KuduHostName:'{1}'." -ArgumentList $userName, $kuduHostName)

    $azureRMWebAppConnectionDetails = @{}
    $azureRMWebAppConnectionDetails.KuduHostName = $kuduHostName
    $azureRMWebAppConnectionDetails.UserName = $userName
    $azureRMWebAppConnectionDetails.UserPassword = $userPassword

    return $azureRMWebAppConnectionDetails
}

function Get-AzureRMWebAppConnectionDetailsWithSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName,
          [String][Parameter(Mandatory=$true)] $slotName)

    Write-Host (Get-LocalizedString -Key "Getting connection details for azureRM WebApp:'{0}' under Slot:'{1}'." -ArgumentList $webAppName, $slotName)

    $kuduHostName = $webAppName + "-" + $slotName + ".scm.azurewebsites.net"
    Write-Host (Get-LocalizedString -Key "`t Using KuduHostName:'{0}' for azureRM WebApp:'{1}' under Slot:'{2}'." -ArgumentList $kuduHostName, $webAppName, $slotName)

    # Get webApp publish profile Object for MSDeploy
    $webAppProfileForMSDeploy =  Get-AzureRMWebAppProfileForMSDeployWithSlot -webAppName $webAppName -resourceGroupName $resourceGroupName -slotName $slotName

    # construct object to store webApp connection details
    $azureRMWebAppConnectionDetailsWithSlot = Construct-AzureWebAppConnectionObject -kuduHostName $kuduHostName -webAppProfileForMSDeploy $webAppProfileForMSDeploy

    Write-Host (Get-LocalizedString -Key "Got connection details for azureRM WebApp:'{0}' under Slot:'{1}'." -ArgumentList $webAppName, $slotName)
    return $azureRMWebAppConnectionDetailsWithSlot
}

function Get-AzureRMWebAppConnectionDetailsWithDefaultSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName)

    Write-Host (Get-LocalizedString -Key "Getting connection details for azureRM WebApp:'{0}' under default Slot." -ArgumentList $webAppName)

    $kuduHostName = $webAppName + ".scm.azurewebsites.net"
    Write-Host (Get-LocalizedString -Key  "`t Using KuduHostName:'{0}' for azureRM WebApp:'{1}' under default Slot." -ArgumentList $kuduHostName, $webAppName)

    # Get azurerm webApp details
    $azureRMWebAppDetails = Get-AzureRMWebAppDetails -webAppName $webAppName

    # Get resourcegroup name under which azure webApp exists
    $azureRMWebAppId = $azureRMWebAppDetails.Id
    Write-Verbose "azureRMWebApp Id = $azureRMWebAppId"

    $resourceGroupName = $azureRMWebAppId.Split('/')[4]
    Write-Host (Get-LocalizedString -Key  "`t ResourceGroup name is:'{0}' for azureRM WebApp:'{1}'." -ArgumentList $resourceGroupName, $webAppName)

    # Get webApp publish profile Object for MSDeploy
    $webAppProfileForMSDeploy =  Get-AzureRMWebAppProfileForMSDeployWithDefaultSlot -webAppName $webAppName -resourceGroupName $resourceGroupName

     # construct object to store webApp connection details
    $azureRMWebAppConnectionDetailsWithDefaultSlot = Construct-AzureWebAppConnectionObject -kuduHostName $kuduHostName -webAppProfileForMSDeploy $webAppProfileForMSDeploy

    Write-Host (Get-LocalizedString -Key "Got connection details for azureRM WebApp:'{0}' under default Slot." -ArgumentList $webAppName)
    return $azureRMWebAppConnectionDetailsWithDefaultSlot
}

function Get-AzureRMWebAppConnectionDetails
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $deployToSpecificSlotFlag,
          [String][Parameter(Mandatory=$false)] $resourceGroupName,
          [String][Parameter(Mandatory=$false)] $slotName)

    if($deployToSpecificSlotFlag -eq "true")
    {
        $azureRMWebAppConnectionDetails = Get-AzureRMWebAppConnectionDetailsWithSlot -webAppName $webAppName -resourceGroupName $ResourceGroupName -slotName $SlotName
    }
    else
    {
         $azureRMWebAppConnectionDetails = Get-AzureRMWebAppConnectionDetailsWithDefaultSlot -webAppName $webAppName
    }

    return $azureRMWebAppConnectionDetails
}