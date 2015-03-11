param(
    [string]$ConnectedServiceName, 
    [string]$csmFile, 
    [string]$csmParametersFile,
    [string]$resourceGroupName,
    [string]$location
)

Write-Verbose -Verbose "Entering script DeployToAzure.ps1"
Write-Verbose -Verbose "resourceGroupName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "csmFile = $csmFile"
Write-Verbose -Verbose "csmParametersFile = $csmParametersFile"

Write-Verbose -Verbose "Switch-AzureMode AzureResourceManager"
Switch-AzureMode AzureResourceManager

$azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName

if(!$azureResourceGroup)
{
	Write-Verbose -Verbose "New-AzureResourceGroup -Name $resourceGroupName -Location $location"
	New-AzureResourceGroup -Name $resourceGroupName -Location $location

	Write-Verbose -Verbose "New-AzureResourceGroupDeployment -Name $resourceGroupName
                                 -ResourceGroupName $resourceGroupName
                                 -TemplateFile $csmFile
                                 -TemplateParameterFile $csmParametersFile"
	$azureResourceGroupDeployment = New-AzureResourceGroupDeployment -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -TemplateParameterFile $csmParametersFile

	Write-Verbose -Verbose "Get-AzureResourceGroup -ResourceGroupName $resourceGroupName"
	$azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName

	Write-Verbose -Verbose  "Leaving script DeployToAzure.ps1"
}
else
{
    Write-Error "Resource group already exists"
}