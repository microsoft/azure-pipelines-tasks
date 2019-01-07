[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [String] [Parameter(Mandatory = $true)]
    $serviceName
)

Write-Host 'Azure PowerShell version is:'
$endpoint=$args[2]
Write-Verbose "Value of second arguementtttttttttttt $step"


try
{
        Write-Host 'Azure PowerShell version is:1111111111111111'

    if($endpoint)
    {
        $authScheme = $endpoint.Auth.Scheme 
    }

    Write-Host 'Azure PowerShell version is:22222222222222222222'
     Write-Verbose "AuthScheme $authScheme"
}
catch
{
   $error = $_.Exception.Message
   Write-Verbose "Unable to get the authScheme $error" 

   Write-Host 'Azure PowerShell version is:33333333333333333'
}

try 
{
         Write-Host 'Azure PowerShell version is:44444444444444444'
    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Initialize-AzModule -Endpoint $endpoint -azVersion $targetAzurePs
}
finally {
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Remove-EndpointSecrets
}