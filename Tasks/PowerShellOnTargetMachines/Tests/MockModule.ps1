function GetEnvironmentWithStandardProvider(
    [string]$environmentName)
{
    return @{ "Name" = $environmentName }
}

function GetEnvironmentWithAzureProvider(
    [string]$environmentName)
{
    return @{ 
        "Name" = $environmentName ;
         "provider" = @{
            "id"="2";
            "name"="AzureResourceGroupManagerV2";
            "url"="https=//builddemos82.dtldev.tfsallin.net/DefaultCollection/demo/_apis/vslabs/providers/ValidProvider"
        };
    }
}

Register-Mock Import-Module { }
Register-Mock Get-ResourceHttpTagKey { return $validResourceWinRMHttpPortKeyName }
Register-Mock Get-ResourceHttpsTagKey { return $validResourceWinRMHttpsPortKeyName }
Register-Mock Write-Telemetry { }
Register-Mock Get-ResourceFQDNTagKey { return $validResourceFQDNKeyName }
Register-Mock Get-VssConnection { return $null }
Register-Mock Get-ResourceCredentials { }
Register-Mock Get-SkipCACheckTagKey { return $validSkipCACheckKeyName}
Register-Mock Write-ResponseLogs { }
Register-Mock Get-ChildItem { return $assembly }