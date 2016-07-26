param(
	$connectedServiceName,$timeOut
)
$dateStart = Get-Date
function GetEndpointData{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)
	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
	if (!$serviceEndpoint)
	{
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}
	return $serviceEndpoint
}

function GetDataFromJson () {
	$JsonFullPath = GetJsonPath 
	if(Test-Path $JsonFullPath){
		[string] $values = (Get-Content $JsonFullPath).Replace(" ","")
		return $values.Split(";")
	}
	else {
		Write-Error "No Records"
	}
}
function CheckStatusOfBuild ($buID) {
	$TeamFoundationCollectionUri = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"
	$TeamProjectName = "$env:SYSTEM_TEAMPROJECT"
	$url = $TeamFoundationCollectionUri+$TeamProjectName
	Write-Host "Build id: $buID"
	$request = ("$url/_apis/build/builds/"+$buID+"?api-version=2.0")
	#Write-Host "url: $request"
	
	## Geting credential
	#Write-Host "Geting credential"
	$serviceEndpoint = GetEndpointData $connectedServiceName;
	$password = $($serviceEndpoint.Authorization.Parameters.Password)
	$username =$($serviceEndpoint.Authorization.Parameters.UserName)
	Write-Host "Geting credential $password| $username"
	
	Write-Host "creating credential for the request..."
	$basicAuth = ("{0}:{1}" -f $username,$password)
	$basicAuth = [System.Text.Encoding]::UTF8.GetBytes($basicAuth)
	$basicAuth = [System.Convert]::ToBase64String($basicAuth)
	$headers = @{Authorization=("Basic {0}" -f $basicAuth)}
	
	
	##get build data
	Write-Host "Checking the status: $buID"
	Write-Host "Sending reqiest..."
	$response = Invoke-RestMethod -headers $headers -Method Get -Uri $request
 	
	 
	[string] $status = $response.status
	Write-Host "Status: $status"
 if($status.Equals("inProgress") -or $status.Equals("notStarted")){
    Write-Host("The status is: $status")
    return 0
 }else{ 
		if($status.Equals("completed")){
			# Write-Host("The status is: $status")
            [string]$result = $response.result
			if($result.Equals("failed") -or $result.Equals("canceled") ){
                 Write-Error("Triggered build is: $result")
				 Exit 1
			}
            
            Write-Host("The status is: $status")
         return 1
		}
        else{
            if($status.Equals("canceled"))
            {
               Write-Error("Triggered build is: $status")
			   Exit 1
            }
        }
	 return $completed = 1
    }
    return 0
}
function GetJsonPath () {
	$currentPath =  $env:BUILD_SOURCESDIRECTORY
	$JsoName = "Ids.json"
	$jsonPat = ("$currentPath\$JsoName")
	Write-Host "Path is:$jsonPat"
	return $jsonPat
}

function DeleteFile ($file) {
	Write-Host "Path is:$file"
	 if (Test-Path $file) {
		 Remove-Item -Path $file 
 		 Write-Host "Removing the list of builds ..."
	}
	else {
	Write-Error "The List No Found $file"
}}
$list = GetDataFromJson

foreach ($tempId in $list){
	$id = ($tempId.Split("="))[0]
	if (![string]::IsNullOrEmpty($id)) {
		$id = $id -replace ' ', ''
		$completed = 0;
		$timeOutMax = $dateStart.AddMinutes($timeOut)
		Write-Host "Started at: $dateStart"
		Write-Host "Timeout will be at: $timeOutMax"
		Write-Host "TimeOut Set (Minutes): $timeOut"
	
	while($completed -eq 0){
			$dateTimeNow =  Get-Date
			if($dateTimeNow -gt $timeOutMax){
				Write-Error("Reached Timeout: $timeOutMax")
				Exit 1
			}else{
                    $completed =  CheckStatusOfBuild -buID $id
            		Start-Sleep -Seconds 60
            	}
          	}
		}
	}
	Write-Host "Updating the list..."








$_filePath = GetJsonPath
DeleteFile -file $_filePath

	





