# Initialize Rest API Helpers.
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
function Get-AccessToken([string]$connectedServiceName, [string]$asAccountName, [bool]$UseAad)
{
    [string]$PersonalAccessToken = (Get-VstsTaskVariable -Name 'ArtifactServices.Symbol.PAT')
    Write-Host "connectedServiceName: $connectedServiceName"

    if($connectedServiceName)
    {
        Write-Host "connectedServiceName is specified. Using it to get the access token. - $connectedServiceName"
        $PersonalAccessToken = Get-ConnectedServiceNameAccessToken($connectedServiceName);
    }
    elseif ($asAccountName) {
        Write-Host "PAT access token"
        $PersonalAccessToken = Get-PATToken([string]$asAccountName, [bool]$UseAad);
    }
    else {
        Write-Host "System access token"
        $PersonalAccessToken = Get-SystemAccessToken([string]$PersonalAccessToken, [bool]$UseAad);<# Action when all if and elseif conditions are false #>
    }

    return $PersonalAccessToken;
}

function Get-ConnectedServiceNameAccessToken([string]$connectedServiceName)
{
    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_

    Write-Host "endpoint for connectedServiceName: $connectedServiceName";
    $endpoint = Get-VstsEndpoint -Name $connectedServiceName -Require
    Write-Host "endpoint: $endpoint";

    Write-Host "vstsEndpoint for SystemVssConnection";
    $vstsEndpoint = Get-VstsEndpoint -Name SystemVssConnection -Require
    Write-Host "vstsEndpoint: $vstsEndpoint";
    $vstsAccessToken = $vstsEndpoint.auth.parameters.AccessToken
    Write-Host "vstsAccessToken";

    if (Get-Module Az.Accounts -ListAvailable) {
        Write-Host "Az.Accounts: -ListAvailable";
        $encryptedToken = ConvertTo-SecureString $vstsAccessToken -AsPlainText -Force
        Write-Host "Initialize-AzModule";
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

function Get-PATToken([string]$asAccountName, [bool]$UseAad)
{
    [string]$PersonalAccessToken = (Get-VstsTaskVariable -Name 'ArtifactServices.Symbol.PAT')

    if ( $asAccountName ) {
        if ( $PersonalAccessToken ) {
            if ( $UseAad ) {
                throw "If AccountName is specified, then only one of PAT or UseAad should be present"
            }

            $variableInfo = Get-VstsTaskVariableInfo | Where-Object { $_.Name -eq "ArtifactServices.Symbol.PAT" }

            if ($variableInfo -and -not $variableInfo.Secret) {
                throw "The PAT needs to be specified as a secret"
            }
        }
        elseif ( -not $UseAad ) {
            throw "If AccountName is specified, then either PAT or UseAad needs to be present"
        }
    }

    return $PersonalAccessToken;
}

function Get-SystemAccessToken([string]$PersonalAccessToken, [bool]$UseAad)
{
    if ( $PersonalAccessToken -or $UseAad ) {
        throw "If PAT or UseAad is specified, then AccountName needs to be present"
    }

    $Endpoint = Get-VstsEndPoint -Name "SystemVssConnection"
    [string]$PersonalAccessToken = $Endpoint.Auth.Parameters.AccessToken

    if ( [string]::IsNullOrEmpty($PersonalAccessToken) ) {
        throw "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator"
    }

    return $PersonalAccessToken
}