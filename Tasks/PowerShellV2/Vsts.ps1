[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [switch]$Require)

$originalErrorActionPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Stop'

    # Get the URL.
    $description = Get-LocString -Key PSLIB_EndpointUrl0 -ArgumentList $Name
    $key = "ENDPOINT_URL_$Name"
    $url = Get-VaultValue -Description $description -Key $key -Require:$Require

    # Get the auth object.
    $description = Get-LocString -Key PSLIB_EndpointAuth0 -ArgumentList $Name
    $key = "ENDPOINT_AUTH_$Name"
    if ($auth = (Get-VaultValue -Description $description -Key $key -Require:$Require)) {
        $auth = ConvertFrom-Json -InputObject $auth
    }

    # Get the data.
    $description = "'$Name' service endpoint data"
    $key = "ENDPOINT_DATA_$Name"
    if ($data = (Get-VaultValue -Description $description -Key $key)) {
        $data = ConvertFrom-Json -InputObject $data
    }

    # Return the endpoint.
    if ($url -or $auth -or $data) {
        New-Object -TypeName psobject -Property @{
            Url = $url
            Auth = $auth
            Data = $data
        }
    }
} catch {
    $ErrorActionPreference = $originalErrorActionPreference
    Write-Error $_
}
