param(
	$BuildDefinitionID, $BuildDefinitionName, $connectedServiceName, $ToWait, $TimeOut, $Changeset,$triggerWithShelveset,
	$ParameterNameA, $ParameterValueA, $ParameterNameB, $ParameterValueB, 
	$ParameterNameC, $ParameterValueC, $ParameterNameD, $ParameterValueD,
	$disableTrigger, $demands
)
#start timer 
$dateStart = Get-Date
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common" 

function GetEndpointData{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)
	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
	if (!$serviceEndpoint)
	{
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}
	return $serviceEndpoint
}

function CheckShelveset() {
    [bool]$triggerWithShelvesetBool = [System.Convert]::ToBoolean($triggerWithShelveset)
    if($triggerWithShelvesetBool -eq $false){
        Write-Host "Will NOT trigger the build with Shelveset (Trigger With Shelveset = Disabled)"
        return $false;
    }
	$TeamFoundationCollectionUri = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"
	$TeamProjectName = "$env:SYSTEM_TEAMPROJECT"
	$url = $TeamFoundationCollectionUri+$TeamProjectName
	$buildID = $env:BUILD_BUILDID 
	Write-Host "Build id is: $buildID"
		$request = "$url/_apis/build/builds/"+$buildID+"?api-version=2.0"
	Write-Verbose "check Shelvset url: $request"
	$response = Invoke-RestMethod -Method Get -Uri $request -headers $headers -ContentType "application/json"
	$sourceBranchTemp = $response.sourceBranch;
	Write-Host "BrancheSource is: $sourceBranchTemp"
	if($sourceBranchTemp.StartsWith("$") -and $sourceBranchTemp -notcontains (";")){
    	return $false;
	}
   	return $sourceBranchTemp
}

function AddDemands () {
	if($demands){
	[string] $equaList = $demands
	if($equaList){
		if(!$equaList.EndsWith(';')){
			$equaList += ";"
		}
		  $equaList = $equaList.Replace('=',' -equals ')
		  $equaList = $equaList.Substring(0,$equaList.Length-1)
		  return $equaList.Split(';')
		}
	}
}


$serviceEndpoint = GetEndpointData $connectedServiceName;
$password = $($serviceEndpoint.Authorization.Parameters.Password)
$username =$($serviceEndpoint.Authorization.Parameters.UserName)
$url = $($serviceEndpoint.Url)
Write-Host("url is: $url")


$basicAuth = ("{0}:{1}" -f $username,$password)
$basicAuth = [System.Text.Encoding]::UTF8.GetBytes($basicAuth)
$basicAuth = [System.Convert]::ToBase64String($basicAuth)
$headers = @{Authorization=("Basic {0}" -f $basicAuth)}

$shelveset = CheckShelveset

$parametersNames = $ParameterNameA, $ParameterNameB, $ParameterNameC, $ParameterNameD
$parametersValues = $ParameterValueA, $ParameterValueB,$ParameterValueC, $ParameterValueD

$count = 0;
$added = 0;
[string]$parameters = "{"
foreach ($p in $parametersNames){
	[string]$DisableChainedBuilds = "DisableChainedBuilds";
		if($p){
			[string]$temp = $parametersValues[$count]
			if($temp){
				[string]$lowerCase = $temp.ToLower();
				if($p.Equals($DisableChainedBuilds) -and ($lowerCase.Equals("true") -or $lowerCase.Equals("yes"))){
					Write-Host "
					 _        _                         _           _ _           _     _          _ 
					| |      (_)                       (_)         | (_)         | |   | |        | |
					| |_ _ __ _  __ _  __ _  ___ _ __   _ ___    __| |_ ___  __ _| |__ | | ___  __| |
					| __|  __| |/ _  |/ _  |/ _ \  __| | / __|  / _  | / __|/ _  |  _ \| |/ _ \/ _  |
					| |_| |  | | (_| | (_| |  __/ |    | \__ \ | (_| | \__ \ (_| | |_) | |  __/ (_| |
					 \__|_|  |_|\__  |\__  |\___|_|    |_|___/  \__ _|_|___/\__ _|_ __/|_|\___|\__ _|
					             __/ | __/ |                                                         
					            |___/ |___/                                                          
					"
					Exit 0
				}		
				else {
						if($temp.Contains('\'))
						{
								$temp = $temp.Replace('\','\\')
						}
					$parameters += """$p""" + ":" + """$temp""" + ","
					#$parameters+= (""{0}":"{1}"," -f $p, $parametersValues[$count])
					Write-Host "param was updated: $parameters"
					$added =+ 1;
					}
			}
		}
	$count += 1
}
	$parameters = $parameters.Remove($parameters.Length-1)
	$parameters +="}"
 #  $parameters= @{$parameters = $parameters}
	Write-Host "param is: $parameters"

#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# Queue a build
$uri = ("{0}/_apis/build/builds?api-version=2.0" -f $url)
Write-Host ("API URI is: $uri")

if($added.Equals(0))
{ # don't have parameters
	Write-Host " 
  _   _  ____    _____        _____            __  __ ______ _______ ______ _____   _____ 
 | \ | |/ __ \  |  __ \ /\   |  __ \     /\   |  \/  |  ____|__   __|  ____|  __ \ / ____|
 |  \| | |  | | | |__) /  \  | |__) |   /  \  | \  / | |__     | |  | |__  | |__) | (___  
 |     | |  | | |  ___/ /\ \ |  _  /   / /\ \ | |\/| |  __|    | |  |  __| |  _  / \___ \ 
 | |\  | |__| | | |  / ____ \| | \ \  / ____ \| |  | | |____   | |  | |____| | \ \ ____) |
 |_| \_|\____/  |_| /_/    \_\_|  \_\/_/    \_\_|  |_|______|  |_|  |______|_|  \_\_____/ 
                                                                                          
                                                                  "
$BUILD_SOURCEVERSION = $env:BUILD_SOURCEVERSION;
	 if($Changeset -eq $true){                       
	
    # $BUILD_SOURCEVERSION = "11111"
	 Write-Host ("SOURCEVERSION: $BUILD_SOURCEVERSION")
	 $body =@{ definition = @{id = $BuildDefinitionID}; sourceVersion = $BUILD_SOURCEVERSION }
	}
	else {
		 $body =@{ definition = @{id = $BuildDefinitionID} }
	}
     #$body =@{ definition = @{id = 1408}; sourceVersion = $BUILD_SOURCEVERSION }
	}

else{
	if($Changeset -eq $true){
		Write-Host ("SOURCEVERSION: $BUILD_SOURCEVERSION")
		 $body =@{ definition = @{id =  $BuildDefinitionID } ; parameters = $parameters ; sourceVersion = $BUILD_SOURCEVERSION }
	}
	else {
			 $body =@{ definition = @{id =  $BuildDefinitionID } ; parameters = $parameters }
	}

}

## add shelveset to trigger
Write-Host "Shelvset is: $shelveset"
if($shelveset){
	$body += @{sourceBranch = $shelveset}
	Write-Host "Shelvset was added"
}
$DemandsValue = AddDemands

if($DemandsValue){
	$body += @{demands =  $DemandsValue  }
}
$json = ConvertTo-Json $body
Write-Host ("JSON::$json")
$response = Invoke-RestMethod -Method POST -Uri $uri -headers $headers -ContentType "application/json" -Body ($json)

#Write-Host $uri
$toRemove = "_apis"
$tempUri = ($response.uri).Split("/");
[string[]]$temp = $uri -split ("_")
$partAUrl = $temp[0]
$buildUri = ("{0}_build?buildId={1}" -f $partAUrl, $tempUri[$tempUri.length-1] )


## check status build
function StatusBuildTriggered ($url, $buDI){
$request = ("$url/_apis/build/builds?definitions=$buDI&api-version=2.0" )
##get build data
 $value = Invoke-RestMethod -headers $headers -Method Get -Uri $request
[string] $status = $value.value.status[0]
 if($status.Equals("inProgress") -or $status.Equals("notStarted")){
    Write-Host("The status is: $status")
    return 0
 }
else{ 
		if($status.Equals("completed")){
            [string]$result = $value.value.result[0]
			if($result.Equals("failed") -or $result.Equals("canceled") ){
                 Write-Error("Triggered build is: $result")
				 Exit 1
			}
            
            Write-Host("The status is: $status")
         return 1
		}
        else{
            if($status.Equals("canceled")){
               Write-Error("Triggered build is: $status")
			   Exit 1
            }
        }
	 return $completed = 1
    }
    return 0
}

$completed = 0;
if($ToWait -eq $true){
	$timeOutMax = $dateStart.AddMinutes($TimeOut)
	Write-Host "Started at: $dateStart"
	Write-Host "Timeout will be at: $timeOutMax"
	Write-Host "TimeOut Set (Minutes): $TimeOut"
	Write-Host "The build was triggered URL:$buildUri" "Build ID :$BuildDefinitionID" "Build name:$BuildDefinitionName"
	while($completed -eq 0){
			$dateTimeNow =  Get-Date
			if($dateTimeNow -gt $timeOutMax){
				Write-Error("Reached Timeout: $timeOutMax")
				Exit 1
			}
            else{
                    $completed =  StatusBuildTriggered -url $Url -buDI $BuildDefinitionID
            		Start-Sleep -Seconds 60
            	}
          	}
}
Write-Host "The build was triggered URL:$buildUri" "Build ID :$BuildDefinitionID" "Build name:$BuildDefinitionName"