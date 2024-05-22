function Get-ConnectedServiceAccessToken ([string]$connectedServiceName, [bool]$usePat)
{
    Write-Host "connectedServiceName: $connectedServiceName";

    if ($usePat) {
        if ($connectedServiceName)
        {
            Write-Host "Both PAT and service connection are provided. Please provide only one.";
            exit 1;
        }
        $patVar = "ArtifactServices.Drop.PAT";
        Write-Host "Retrieving PAT from to pipeline variable ${patVar}";
        return patVar;
      }

      if ($connectedServiceName)
      {
        Write-Host "Retrieving access token from service connection.";
        return GetConnectedServiceAccessToken($connectedServiceName);
      }
}

function GetConnectedServiceAccessToken([string]$connectedServiceName)
{

    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_

    $endpoint = Get-VstsEndpoint -Name $connectedServiceName -Require
    Write-Host "endpoint: $endpoint";

    $vstsEndpoint = Get-VstsEndpoint -Name SystemVssConnection -Require
    Write-Host "vstsEndpoint: $vstsEndpoint";
    $vstsAccessToken = $vstsEndpoint.auth.parameters.AccessToken

    if (Get-Module Az.Accounts -ListAvailable) {
        Write-Host "Az.Accounts: -ListAvailable";
        $encryptedToken = ConvertTo-SecureString $vstsAccessToken -AsPlainText -Force
        Initialize-AzModule -Endpoint $endpoint -connectedServiceNameARM $connectedServiceName -encryptedToken $encryptedToken
    }
    else {
        Write-Verbose "No module found with name: Az.Accounts"
        throw ("Could not find the module Az.Accounts with given version. If the module was recently installed, retry after restarting the Azure Pipelines task agent.")
    }

    Write-Host "Get Token: az account get-access-token --query accessToken --resource 499b84ac-1321-427f-aa17-267ca6975798 -o tsv";
    $accessToken = az account get-access-token --query accessToken --resource 499b84ac-1321-427f-aa17-267ca6975798 -o tsv

    return $accessToken
}