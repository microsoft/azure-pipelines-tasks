function Get-CltEndpoint($connectedServiceUrl, $headers)
{
	# Load all dependent files for execution
	. $PSScriptRoot/CltTasksUtility.ps1
	$vsoUrl = $connectedServiceUrl
	Write-Host -NoNewline "Fetching the Clt endpoint for $vsoUrl"
	$spsLocation = Get-SpsLocation $vsoUrl $headers
	$cltLocation = Get-CltLocation $spsLocation $headers
	return $cltLocation

}

function Get-SpsLocation($vsoUrl, $headers)
{
	Write-Host -NoNewline "Fetching the SPS endpoint for $vsoUrl"
	$spsUniqueIdentifier = "951917AC-A960-4999-8464-E3F0AA25B381"
	$spsLocation = Get-ServiceLocation $vsoUrl $headers $spsUniqueIdentifier
	return $spsLocation
}

function Get-CltLocation($spsUrl, $headers)
{
	Write-Host -NoNewline "Fetching the CLT endpoint for $vsoUrl"
	$cltUniqueIdentifier = "6C404D78-EF65-4E65-8B6A-DF19D6361EAE"
	return Get-ServiceLocation $spsUrl $headers $cltUniqueIdentifier
}

function Get-ServiceLocation($baseUrl, $headers, $serviceUniqueIdentifier)
{
	# Load all dependent files for execution
	. $PSScriptRoot/CltTasksUtility.ps1
	$locationCallUri = [string]::Format("{0}/_apis/servicedefinitions/LocationService2/{1}", $baseUrl, $serviceUniqueIdentifier)
	$locationCallJsonResponse = InvokeRestMethod -Uri $locationCallUri -contentType "application/json" -headers $headers -Method Get
	if($locationCallJsonResponse)
	{
		return $locationCallJsonResponse.locationMappings.location|Select -First 1
	}
	
	return $null
}