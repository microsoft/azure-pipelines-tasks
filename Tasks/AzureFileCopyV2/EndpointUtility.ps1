function Get-EndpointAuthenticationScheme
{
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    $authenticationScheme = ""

    try
    {
        $serviceNameInput = Get-VstsInput -Name "ConnectedServiceNameSelector" -Default "ConnectedServiceNameARM"
        $serviceName = Get-VstsInput -Name $serviceNameInput

        $endpoint = Get-VstsEndpoint -Name $serviceName -Require
        $authenticationScheme = $endpoint.Auth.Scheme
    }
    catch
    {
        Write-Verbose "Get-EndpointAuthenticationScheme. Exception $($_.Exception.Message)"
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }

    return $authenticationScheme
}