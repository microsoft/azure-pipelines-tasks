
param($connectedServiceName, $capabilitiyKey, $capabilitiyValue)

	[string]$temp = $env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI
	[string]$serverUrlPre = $temp.Substring(0,$($temp.LastIndexOf('/')))
	[string]$serverUrl = $serverUrlPre.Substring(0,$($serverUrlPre.LastIndexOf('/')))
	Write-Host "ServerUrl:: $serverUrl"
	

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common" 

$BUILDID = $env:BUILD_BUILDID 
$AGENT_ID = $env:AGENT_ID;
$TEAMFOUNDATIONCOLLECTIONURI = $env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI
$SYSTEM_TEAMPROJECT = $env:SYSTEM_TEAMPROJECT

Write-Host "BUILD ID $BUILDID"
Write-Host "AGENT ID $AGENT_ID"

function GetEndpointData{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)
	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
	if (!$serviceEndpoint)
	{
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}
	return $serviceEndpoint
}
function GetCredation{
	
	$serviceEndpoint = GetEndpointData $connectedServiceName;
	$password = $($serviceEndpoint.Authorization.Parameters.Password)
	$username =$($serviceEndpoint.Authorization.Parameters.UserName)
	Write-Host "Credential : $username | $password"
	$basicAuth = ("{0}:{1}" -f $username,$password)
	$basicAuth = [System.Text.Encoding]::UTF8.GetBytes($basicAuth)
	$basicAuth = [System.Convert]::ToBase64String($basicAuth)
	Write-Host "Getting Credentials"
	return @{Authorization=("Basic {0}" -f $basicAuth)}
}
function GetPoolID{
	
	$headers = GetCredation
	$urlToGetPoolID = "$TEAMFOUNDATIONCOLLECTIONURI$SYSTEM_TEAMPROJECT/_apis/build/builds/"+$BUILDID+"?api-version=2.0"
	$responseCurrentBuildDetails = Invoke-RestMethod -Method Get -Uri $urlToGetPoolID -Headers $headers
	$poolName = $responseCurrentBuildDetails.queue.pool.name
	$teemPoolId = $responseCurrentBuildDetails.queue.pool.id
	Write-Host "Pool Name : $PoolName", "Pool ID:$teemPoolId"
	Write-Host "Received Pool ID"
	return $teemPoolId
}

function AddCapabilitiesToServer ($poolID) {
	Write-Host "Adding Capabilities To Server"

	$urlToPostCapabilities = $serverUrl+ "/_apis/distributedtask/pools/"+$poolID+"/agents/"+$AGENT_ID+"/usercapabilities?api-version=3.0-preview.1"
	Write-Host "Capabilities URL POST :: $urlToPostCapabilities"
	$existCapabilities = GetAgentCapabilit
	Write-Host "got exist capabilities"
	

	# Convert the PSCustomObject back to a hashtable
	$dict =@{}
	if($existCapabilities){
	$existCapabilities.psobject.properties | Foreach { $dict[$_.Name] = $_.Value }
	}
	# add new value / check if exist
	if($dict.$capabilitiyKey){
		$dict.Remove($capabilitiyKey)
	}
	$dict.Add($capabilitiyKey,$capabilitiyValue)

	#conver to json and send
	$json = ConvertTo-Json $dict
	Write-Host "JSON:: $json"
	$headers = GetCredation
	$response = Invoke-RestMethod -Method Put -Uri $urlToPostCapabilities -Headers $headers -Body $json -ContentType "application/json"
	Write-Host "AddCapabilitiesToServer: $response"

}


function GetAgentCapabilit () {
	Write-Host "Getting Agent Capabilities"
	$headers = GetCredation
	$urlToPostCapabilities = $serverUrl + "/_apis/distributedtask/pools/" + $poolID + "/agents/"+$AGENT_ID+"?includeCapabilities=true&includeAssignedRequest=true?api-version=3.0-preview.1"
	Write-Host "ACP:: $urlToPostCapabilities"
	$response = Invoke-RestMethod -Method Get -Uri $urlToPostCapabilities -Headers $headers
	return $response.userCapabilities
	 
}
function CheckIfCapabilityAdded () {
	Write-Host "Checking If Capability Addeded"
 	[string] $callBack = GetAgentCapabilit
    Write-Host "Current capabilities : $callBack"
	if(!$callBack.Contains($capabilitiyKey)){
		throw "Capability wosn't added"
	}
	Write-Host "               _     _          _                                    __       _ _       
                              | |   | |        | |                                  / _|     | | |      
__      ____ _ ___    __ _  __| | __| | ___  __| |  ___ _   _  ___ ___ ___  ___ ___| |_ _   _| | |_   _ 
\ \ /\ / / _  / __|  / _  |/ _  |/ _  |/ _ \/ _` | / __| | | |/ __/ __/ _ \/ __/ __|  _| | | | | | | | |
 \ V  V / (_| \__ \ | (_| | (_| | (_| |  __/ (_| | \__ \ |_| | (_| (_|  __/\__ \__ \ | | |_| | | | |_| |
  \_/\_/ \__ _|___/  \__ _|\__ _|\__ _|\___|\__ _| |___/\__ _|\___\___\___||___/___/_|  \__ _|_|_|\__  |
                                                                                                   __/ |
                                                                                                  |___/ 
	"
}

$poolId = GetPoolID
AddCapabilitiesToServer -poolID $poolId
CheckIfCapabilityAdded