$ErrorActionPreference = 'Stop'

function Get-AzureRMWebAppDetails
{
    param([String][Parameter(Mandatory=$true)] $webAppName)

    Write-Verbose "`t [Azure Call]Getting azureRM WebApp:'$webAppName' details."
    $azureRMWebAppDetails = Get-AzureRMWebApp -Name $webAppName
    Write-Verbose "`t [Azure Call]Got azureRM WebApp:'$webAppName' details."

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