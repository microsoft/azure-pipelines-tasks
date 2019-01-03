Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

$targetAzurePs = Get-VstsInput -Name TargetAzurePs

try
{
    $serviceName = Get-VstsInput -Name ConnectedServiceNameARM
    if (!$serviceName)
    {
            Get-VstsInput -Name $ConnectedServiceNameARM -Require
    }

    $endpoint = Get-VstsEndpoint -Name $serviceName -Require

    if($endpoint)
    {
        $authScheme = $endpoint.Auth.Scheme 
    }

     Write-Verbose "AuthScheme $authScheme"
}
catch
{
   $error = $_.Exception.Message
   Write-Verbose "Unable to get the authScheme $error" 
}

try 
{
    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Initialize-AzModule -Endpoint $endpoint -azVersion $targetAzurePs
}
finally {
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Remove-EndpointSecrets
}