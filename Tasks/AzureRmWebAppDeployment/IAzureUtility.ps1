# returns azure webapp 
function Get-AzureRMWebAppARM
{
    param([String] [Parameter(Mandatory = $true)] $Name)
}

function Construct-AzureWebAppConnectionObject
{
    param([String][Parameter(Mandatory=$true)] $kuduHostName,
          [Object][Parameter(Mandatory=$true)] $webAppProfileForMSDeploy)
}

function Get-AzureRMWebAppProfileForMSDeployWithProductionSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName)

}

function Get-AzureRMWebAppProfileForMSDeployWithSpecificSlot
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $resourceGroupName,
          [String][Parameter(Mandatory=$true)] $slotName)

}
