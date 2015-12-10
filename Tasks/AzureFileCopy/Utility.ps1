# Utility Functions used by AzureFileCopy.ps1 (other than azure calls) #

$ErrorActionPreference = 'Stop'
$doSkipCACheckOption = '-SkipCACheck'
$doNotSkipCACheckOption = ''

# Telemetry

$telemetryCodes = 
@{
  "PREREQ_NoWinRMHTTP_Port" = "PREREQ001";
  "PREREQ_NoWinRMHTTPSPort" = "PREREQ002";
  "PREREQ_NoResources" = "PREREQ003";
  "PREREQ_NoOutputVariableForSelectActionInAzureRG" = "PREREQ004";
  "PREREQ_InvalidServiceConnectionType" = "PREREQ_InvalidServiceConnectionType";
  "PREREQ_AzureRMModuleNotFound" = "PREREQ_AzureRMModuleNotFound";
  "PREREQ_InvalidFilePath" = "PREREQ_InvalidFilePath";
  "PREREQ_StorageAccountNotFound" = "PREREQ_StorageAccountNotFound";
  "PREREQ_NoVMResources" = "PREREQ_NoVMResources";
  "PREREQ_UnsupportedAzurePSVerion" = "PREREQ_UnsupportedAzurePSVerion";

  "AZUREPLATFORM_BlobUploadFailed" = "AZUREPLATFORM_BlobUploadFailed";
  "AZUREPLATFORM_UnknownGetRMVMError" = "AZUREPLATFORM_UnknownGetRMVMError";

  "UNKNOWNPREDEP_Error" = "UNKNOWNPREDEP001";
  "UNKNOWNDEP_Error" = "UNKNOWNDEP_Error";

  "DEPLOYMENT_Failed" = "DEP001";
  "DEPLOYMENT_FetchPropertyFromMap" = "DEPLOYMENT_FetchPropertyFromMap";
  "DEPLOYMENT_CSMDeploymentFailed" = "DEPLOYMENT_CSMDeploymentFailed";
  
  "DEPLOYMENT_PerformActionFailed" = "DEPLOYMENT_PerformActionFailed"

  "FILTERING_IncorrectFormat" = "FILTERING_IncorrectFOrmat";
  "FILTERING_NoVMResources" = "FILTERING_NoVMResources";
 }

function Write-Telemetry
{
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$True,Position=1)]
    [string]$codeKey,

    [Parameter(Mandatory=$True,Position=2)]
    [string]$taskId
    )
  
  if($telemetrySet)
  {
    return
  }

  $code = $telemetryCodes[$codeKey]
  $telemetryString = "##vso[task.logissue type=error;code=" + $code + ";TaskId=" + $taskId + ";]"
  Write-Host $telemetryString
  $telemetrySet = $true
}

function Write-TaskSpecificTelemetry
{
    param(
      [string]$codeKey
      )

    Write-Telemetry "$codeKey" "EB72CB01-A7E5-427B-A8A1-1B31CCAC8A43"
}

function Does-RequireSwitchAzureMode
{
    $azureVersion = Get-AzureCmdletsVersion

    $versionToCompare = New-Object -TypeName System.Version -ArgumentList "0.9.9"

    $result = Get-AzureVersionComparison -AzureVersion $azureVersion -CompareVersion $versionToCompare

    if(!$result)
    {
        Write-Verbose "Switch Azure mode is required." -Verbose
    }
    else
    {
        Write-Verbose "Switch Azure mode is not required." -Verbose
    }

    return !$result
}

function ThrowError
{
    param([string]$errorMessage)

    $readmelink = "http://aka.ms/azurefilecopyreadme"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

function Validate-AzurePowershellVersion
{
    Write-Verbose "Validating minimum required azure powershell version" -Verbose

    $currentVersion =  Get-AzureCmdletsVersion
    $minimumAzureVersion = New-Object System.Version(0, 9, 0)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion
    
    if(!$versionCompatible)
    {
        Write-TaskSpecificTelemetry "PREREQ_UnsupportedAzurePSVerion"
        Throw (Get-LocalizedString -Key "The required minimum version {0} of the Azure Powershell Cmdlets are not installed. You can follow the instructions at http://azure.microsoft.com/en-in/documentation/articles/powershell-install-configure/ to get the latest Azure powershell" -ArgumentList $minimumAzureVersion)
    }

    Write-Verbose -Verbose "Validated the required azure powershell version"
}

function Get-AzureVMsCredentials
{
    param([string]$vmsAdminUserName,
          [string]$vmsAdminPassword)

    Write-Verbose "Azure VMs Admin Username: $vmsAdminUserName" -Verbose

    $azureVmsCredentials = New-Object 'System.Net.NetworkCredential' -ArgumentList $vmsAdminUserName, $vmsAdminPassword

    return $azureVmsCredentials
 }

function Get-SkipCACheckOption
{
    param([string]$skipCACheck)

    if ($skipCACheck -eq "false")
    {
        Write-Verbose "Not skipping CA Check" -Verbose
        return $doNotSkipCACheckOption
    }

    Write-Verbose "Skipping CA Check" -Verbose
    return $doSkipCACheckOption
}