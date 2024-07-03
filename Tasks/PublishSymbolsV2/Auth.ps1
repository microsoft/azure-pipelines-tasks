Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_

function Get-AccessToken()
{
    param (
        [string]$ConnectedServiceName,
        [string]$AsAccountName,
        [bool]$UseAad
    )

    [string]$PersonalAccessToken = (Get-VstsTaskVariable -Name 'ArtifactServices.Symbol.PAT')
    Write-Host "connectedServiceName: $ConnectedServiceName"

    if($ConnectedServiceName)
    {
        Write-Host "connectedServiceName is specified. Using it to get the access token. - $ConnectedServiceName"
        $accessToken = Get-ConnectedServiceNameAccessToken -connectedServiceName $ConnectedServiceName;
        $PersonalAccessToken = $accessToken.access_token;
        Write-Host "accessToken.access_token. - $accessToken.access_token"
    }
    elseif ($AsAccountName) {
        Write-Host "PAT access token"
        $PersonalAccessToken = Get-PATToken -AsAccountName $AsAccountName -UseAad $UseAad;
    }
    else {
        <# Action when all if and elseif conditions are false #>
        Write-Host "System access token"
        $PersonalAccessToken = Get-SystemAccessToken -PersonalAccessToken $PersonalAccessToken -UseAad $UseAad;
    }

    Write-Host "Received PersonalAccessToken: $PersonalAccessToken"
    return $PersonalAccessToken;
}

function Get-ConnectedServiceNameAccessToken()
{
    param (
        [string]$connectedServiceName
    )

    $accessToken = @{
        token_type = $null
        access_token = $null
        expires_on = $null
    }
    Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_ -Force

    Write-Host "endpoint for connectedServiceName: $connectedServiceName";
    $vstsEndpoint = Get-VstsEndpoint -Name $connectedServiceName -Require
    Write-Host "endpoint: $endpoint";

    $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint `
        -connectedServiceNameARM $connectedServiceName `
        -scope "499b84ac-1321-427f-aa17-267ca6975798"

    $accessToken.token_type = $result.TokenType
    $accessToken.access_token = $result.AccessToken
    $accessToken.expires_on = $result.ExpiresOn.ToUnixTimeSeconds()

    Write-Host "Get-ConnectedServiceNameAccessToken: Received accessToken";

    return $accessToken;
}

# Get the Bearer Access Token - MSAL
function Get-ADOAccessTokenMSAL()
{
    param(
        [Object] [Parameter(Mandatory = $true)] $endpoint,
        [string] [Parameter(Mandatory=$false)] $connectedServiceNameARM
    )

    Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_ -Force

    Get-MSALInstance $endpoint $connectedServiceNameARM

    # prepare MSAL scopes
    [string] $azureDevOpsResourceId = "499b84ac-1321-427f-aa17-267ca6975798";
    $azureDevOpsResourceId = $azureDevOpsResourceId + "/.default"
    $scopes = [Collections.Generic.List[string]]@($azureDevOpsResourceId)

    try {
        Write-Verbose "Fetching Access Token - MSAL"
        $tokenResult = $script:msalClientInstance.AcquireTokenForClient($scopes).ExecuteAsync().GetAwaiter().GetResult()
        return $tokenResult
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AccessTokenMSAL)"
        throw (Get-VstsLocString -Key AZ_SpnAccessTokenFetchFailure -ArgumentList $endpoint.Auth.Parameters.TenantId)
    }
}

function Get-PATToken()
{
    param(
        [string] [Parameter(Mandatory = $true)] $AsAccountName,
        [string] [Parameter(Mandatory=$true)] $UseAad
    )

    [string]$PersonalAccessToken = (Get-VstsTaskVariable -Name 'ArtifactServices.Symbol.PAT')

    if ( $AsAccountName ) {
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

function Get-SystemAccessToken()
{
    param(
        [string] [Parameter(Mandatory = $true)] $PersonalAccessToken,
        [string] [Parameter(Mandatory=$true)] $UseAad
    )
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