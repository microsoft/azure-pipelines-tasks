[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

try{

	# Get inputs.
	$WebAppName = Get-VstsInput -Name WebAppName -Require
	$DeployToSlotFlag = Get-VstsInput -Name DeployToSlotFlag -Require
	$ResourceGroupName = Get-VstsInput -Name ResourceGroupName
	$SlotName = Get-VstsInput -Name SlotName
	$Package = Get-VstsInput -Name Package -Require
	$RemoveAdditionalFilesFlag = Get-VstsInput -Name ScriptArgument
	$ExcludeFilesFromAppDataFlag = Get-VstsInput -Name ExcludeFilesFromAppDataFlag 
	$TakeAppOfflineFlag = Get-VstsInput -Name TakeAppOfflineFlag 
	$VirtualApplication = Get-VstsInput -Name VirtualApplication 
	$AdditionalArguments = Get-VstsInput -Name AdditionalArguments 
	$WebAppUri = Get-VstsInput -Name WebAppUri
	$SetParametersFile = Get-VstsInput -Name SetParametersFile

	# Initialize Azure.

	Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
	Initialize-Azure

	# Import the loc strings.
	Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json


	Write-Verbose "Starting AzureRM WebApp Deployment Task"

	Write-Verbose "ConnectedServiceName = $ConnectedServiceName"
	Write-Verbose "WebAppName = $WebAppName"
	Write-Verbose "DeployToSlotFlag = $DeployToSlotFlag"
	Write-Verbose "ResourceGroupName = $ResourceGroupName"
	Write-Verbose "SlotName = $SlotName"
	Write-Verbose "Package = $Package"
	Write-Verbose "SetParametersFile = $SetParametersFile"
	Write-Verbose "RemoveAdditionalFilesFlag = $RemoveAdditionalFilesFlag"
	Write-Verbose "ExcludeFilesFromAppDataFlag = $ExcludeFilesFromAppDataFlag"
	Write-Verbose "TakeAppOfflineFlag = $TakeAppOfflineFlag"
	Write-Verbose "VirtualApplication = $VirtualApplication"
	Write-Verbose "AdditionalArguments = $AdditionalArguments"
	Write-Verbose "WebAppUri = $WebAppUri"

	$WebAppUri = $WebAppUri.Trim()
	$Package = $Package.Trim('"').Trim()

	if( [string]::IsNullOrEmpty($Package) ){
		Throw (Get-VstsLocString -Key "Invalidwebapppackagepathprovided")
	}

	if ($ExcludeFilesFromAppDataFlag -match '[\r\n]' -or [string]::IsNullOrEmpty($ExcludeFilesFromAppDataFlag)) {
		$ExcludeFilesFromAppDataFlag = $false
	}

	if ($TakeAppOfflineFlag -match '[\r\n]' -or [string]::IsNullOrEmpty($TakeAppOfflineFlag)) {
		$TakeAppOfflineFlag = $false
	}

	if ($RemoveAdditionalFilesFlag -match '[\r\n]' -or [string]::IsNullOrEmpty($RemoveAdditionalFilesFlag)) {
		$RemoveAdditionalFilesFlag = $false
	}

	$SetParametersFile = $SetParametersFile.Trim('"').Trim()


	# Load all dependent files for execution
	Import-Module ./AzureUtility.ps1 -Force
	Import-Module ./Utility.ps1 -Force
	Import-Module ./FindInstalledMSDeploy.ps1

	 # Importing required version of azure cmdlets according to azureps installed on machine
	 $azureUtility = Get-AzureUtility

	 Write-Verbose  "Loading $azureUtility"
	 Import-Module ./$azureUtility -Force

	$ErrorActionPreference = 'Stop'

	#### MAIN EXECUTION OF AZURERM WEBAPP DEPLOYMENT TASK BEGINS HERE ####

	# Get msdeploy.exe path
	$msDeployExePath = Get-MsDeployExePath

	# Ensure that at most a package (.zip) file is found
	$packageFilePath = Get-SingleFilePath -file $Package

	Write-Verbose "Value of package file path : $SetParametersFile" -verbose

	# Since the SetParametersFile is optional, but it's a FilePath type, it will have the value System.DefaultWorkingDirectory when not specified
	if( $SetParametersFile -eq $env:SYSTEM_DEFAULTWORKINGDIRECTORY -or $SetParametersFile -eq [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\" ) -or [string]::IsNullOrEmpty($SetParametersFile) ){
		Write-Verbose "Is empty" -verbose
		$setParametersFilePath = ""
	} else {
		Write-Verbose "Is not empty" -verbose
		$setParametersFilePath = Get-SingleFilePath -file $SetParametersFile
	}

	# Get destination azureRM webApp connection details
	$azureRMWebAppConnectionDetails = Get-AzureRMWebAppConnectionDetails -webAppName $WebAppName -deployToSlotFlag $DeployToSlotFlag `
																		   -resourceGroupName $ResourceGroupName -slotName $SlotName

	# webApp Name to be used in msdeploy command
	$webAppNameForMSDeployCmd = Get-WebAppNameForMSDeployCmd -webAppName $WebAppName -deployToSlotFlag $DeployToSlotFlag -slotName $SlotName

	# Construct arguments for msdeploy command
	$msDeployCmdArgs = Get-MsDeployCmdArgs -packageFile $packageFilePath -webAppNameForMSDeployCmd $webAppNameForMSDeployCmd -azureRMWebAppConnectionDetails $azureRMWebAppConnectionDetails -removeAdditionalFilesFlag $RemoveAdditionalFilesFlag `
										   -excludeFilesFromAppDataFlag $ExcludeFilesFromAppDataFlag -takeAppOfflineFlag $TakeAppOfflineFlag -virtualApplication $VirtualApplication -AdditionalArguments $AdditionalArguments `
										   -setParametersFile $setParametersFilePath

	# Deploy azureRM webApp using msdeploy Command
	Run-MsDeployCommand -msDeployExePath $msDeployExePath -msDeployCmdArgs $msDeployCmdArgs

	# Get azure webapp hosted url
	$azureWebsitePublishURL = Get-AzureRMWebAppPublishUrl -webAppName $WebAppName -deployToSlotFlag $DeployToSlotFlag `
																		   -resourceGroupName $ResourceGroupName -slotName $SlotName

	# Publish azure webApp url
	Write-Host (Get-VstsLocString -Key "WebappsuccessfullypublishedatUrl0" -ArgumentList $azureWebsitePublishURL)

	# Set ouput vairable with azureWebsitePublishUrl
	if(-not [string]::IsNullOrEmpty($WebAppUri))
	{
	
		if( [string]::IsNullOrEmpty($azureWebsitePublishURL))
		{
			Throw (Get-VstsLocString -Key "Unabletoretrievewebapppublishurlforwebapp0" -ArgumentList $webAppName)
		}
	
		Write-Host "##vso[task.setvariable variable=$WebAppUri;]$azureWebsitePublishURL"
	}

	Write-Verbose "Completed AzureRM WebApp Deployment Task"

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}



