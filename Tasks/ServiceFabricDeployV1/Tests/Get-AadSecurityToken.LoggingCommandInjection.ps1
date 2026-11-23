[CmdletBinding()]
param()

# Regression test for the Azure Active Directory settings of the cluster, which the shared connection helper writes to
# the log before it acquires a token. The cluster provides them, so a logging command in one of them must never reach
# the agent as a command. The token must still be requested with the values exactly as the cluster provided them.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$injection = '##vso[task.setvariable variable=INJECTED]x'
$defusedInjection = '##_vso[task.setvariable variable=INJECTED]x'

$global:ClusterMetadataUnderTest = $null
$global:AuthorityRequested = $null
$global:TokenRequested = $null

$authContext = New-Object PSObject
Add-Member -InputObject $authContext -MemberType ScriptMethod -Name AcquireToken -Value {
    param([string]$clusterApplicationId, [string]$clientApplicationId, $userCredential)

    $global:TokenRequested = @{ ClusterApplication = $clusterApplicationId; ClientApplication = $clientApplicationId }
    return @{ AccessToken = 'access token' }
}
$global:AuthContextUnderTest = $authContext

# The cluster only answers the metadata request, and the token is acquired with ADAL because USE_MSAL is not set.
Register-Mock Connect-ServiceFabricClusterAction { $global:ClusterMetadataUnderTest }
Register-Mock Get-VstsTaskVariable
Register-Mock Add-Type
Register-Mock Create-Object {
    param([string]$TypeName, [object[]]$ArgumentList)

    if ($TypeName -like '*AuthenticationContext')
    {
        $global:AuthorityRequested = $ArgumentList[0]
        return $global:AuthContextUnderTest
    }
}
Register-HostCapture

. $PSScriptRoot\..\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1

function Get-TokenForCluster
{
    Get-AadSecurityToken `
        -ClusterConnectionParameters @{ ConnectionEndpoint = 'cluster.example:19000' } `
        -ConnectedServiceEndpoint @{ Auth = @{ Parameters = @{ Username = 'user'; Password = 'password' } } }
}

# Act 1: ordinary values are written exactly as before and raise no audit event.
$global:ClusterMetadataUnderTest = @{
    AzureActiveDirectoryMetadata = @{
        Authority          = 'https://login.example/tenant'
        ClusterApplication = 'cluster-app-id'
        ClientApplication  = 'client-app-id'
    }
}
$token = Get-TokenForCluster

Assert-AreEqual 'access token' $token
Assert-LogLineWritten 'AadAuthority https://login.example/tenant'
Assert-LogLineWritten 'ClusterAppId cluster-app-id'
Assert-LogLineWritten 'ClientAppId client-app-id'
Assert-NoAuditEventWritten

# Act 2: a marker in each of the three settings, twice at the start of a line and once inside text. Each of the three
# sinks must raise its own audit event.
Clear-HostCapture
$global:ClusterMetadataUnderTest = @{
    AzureActiveDirectoryMetadata = @{
        Authority          = "https://login.example/tenant`n$injection"
        ClusterApplication = "cluster-app $injection"
        ClientApplication  = "client-app`n$injection"
    }
}
$token = Get-TokenForCluster

Assert-NoLiveLoggingCommands
Assert-AuditEventWritten 'task.setvariable' -Count 3
Assert-LogLineWritten "AadAuthority https://login.example/tenant`n$defusedInjection"
Assert-LogLineWritten "ClusterAppId cluster-app $defusedInjection"
Assert-LogLineWritten "ClientAppId client-app`n$defusedInjection"

# Only the log is neutralized: the token is still requested from the authority and applications the cluster named.
Assert-AreEqual 'access token' $token
Assert-AreEqual "https://login.example/tenant`n$injection" $global:AuthorityRequested
Assert-AreEqual "cluster-app $injection" $global:TokenRequested.ClusterApplication
Assert-AreEqual "client-app`n$injection" $global:TokenRequested.ClientApplication
