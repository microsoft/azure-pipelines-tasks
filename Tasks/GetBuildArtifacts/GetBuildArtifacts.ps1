###########Define Variables########
param
(
    [parameter(mandatory=$true)][string]$buildDefName,
    [parameter(mandatory=$true)][string]$buildDefID, 
    [parameter(mandatory=$true)][string]$artifactPathVarName,
    #[parameter(mandatory=$false)][string]$useArtifactVariableValue,
    [parameter(mandatory=$false)][string]$buildArtifactName,        
    [parameter(mandatory=$true)][string]$connectedServiceName,  
    [parameter(mandatory=$false)][string]$latestSucceeded,
    [parameter(mandatory=$false)][string]$buildQuality,
    [parameter(mandatory=$false)][string]$customFilter
)
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common" 


########### Functions #############
function GetEndpointData
{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)
	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
	if (!$serviceEndpoint)
    {
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}
	return $serviceEndpoint
}

function Create-Header
{
    $serviceEndpoint = GetEndpointData $connectedServiceName;
    $VSOUserName =$($serviceEndpoint.Authorization.Parameters.UserName)
    $PAT = $($serviceEndpoint.Authorization.Parameters.Password)

    $basicAuth = ("{0}:{1}" -f $VSOUserName,$PAT)
    $basicAuth = [System.Text.Encoding]::UTF8.GetBytes($basicAuth)
    $basicAuth = [System.Convert]::ToBase64String($basicAuth)
    $headers = @{Authorization=("Basic {0}" -f $basicAuth)}

    return $headers
}

function Get-BuildInfo
{
    $Headers=Create-Header

    $BuildUrl = $TeamFoundationCollectionUri + "$TeamProjectName" + '/_apis/build/builds?definitions=' + $buildDefID

    [bool]$latestSucceededBool = [System.Convert]::ToBoolean($latestSucceeded)

    if(($latestSucceededBool -eq $true))
    {
        $BuildUrl += '&statusFilter=completed&resultFilter=succeeded&$top=1'
    }
    if($buildQuality)
    {
        $BuildUrl += '&qualityFilter=' + $buildQuality
    }
    if($customFilter)
    {
        $BuildUrl += '&' + $customFilter
    }    
    $BuildUrl += '&api-version=2.0'
    Write-Host "Get-BuildInfo: $BuildUrl"
    $BuildInfo = Invoke-RestMethod -Uri ($BuildUrl) -Method GET -Headers $Headers
   
    return $BuildInfo
}

function Get-BuildArtifacts($buildId)
{
    $Headers=Create-Header

    $BuildArtifacts = Invoke-RestMethod -Uri ($TeamFoundationCollectionUri + "$TeamProjectName" + "/_apis/build/builds/$buildId/artifacts?api-version=2.0") -Method GET -Headers $Headers
   
    $artifacts=@()
    foreach($val in $BuildArtifacts.value)
    {
        $artifacts+=@($val)
    }
    return $artifacts
}


########### Execution #############
Try
{
    #[bool]$useArtifactVarValBool = [System.Convert]::ToBoolean($useArtifactVariableValue)
    $artifactVarVal = [Environment]::GetEnvironmentVariable($artifactPathVarName)    
        
    #if(($useArtifactVarValBool -eq $true) -and $artifactVarVal -and (!$artifactVarVal.StartsWith("$")))
    if($artifactVarVal -and (!$artifactVarVal.StartsWith("$")))
    {
        $str = "Will NOT get Artifacts into " + "$" + "($artifactPathVarName) because it's NOT empty"
        Write-Host $str
        $str = "$" + "($artifactPathVarName) = $artifactVarVal"
        Write-Host $str
        Exit(0)      
    }

    if($artifactPathVarName.StartsWith("$"))
    {
        Write-Warning "Artifact variable name starts with $"
    }

    #Team Build Environment Variables
    $TeamFoundationCollectionUri = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"
    $TeamProjectName = "$env:SYSTEM_TEAMPROJECT"
    #$BuildId = "$env:BUILD_BUILDID"

    #Getting Variables from Build Defintion Variables
    Write-Output "TFS Uri: $TeamFoundationCollectionUri"
    Write-Output "Team Project: $TeamProjectName"
    #Write-Output "BuildId: $($BuildId)"
    
    $BuildDetails = Get-BuildInfo
    $buildID = $BuildDetails.value.id
    Write-Host "Getting artifacts of build [$buildDefName] from build with id [$buildID]..."    
    $artifacts = Get-BuildArtifacts($buildID)
    
    #find build Artifact path according to name of artifact
    foreach($artifact in $artifacts)
    {   
        if($buildArtifactName)
        {
            $artifactName = ($artifact.name)
            if($artifactName -ne $buildArtifactName)
            {
                continue
            }
            else
            {    
                $artifactPath = ($artifact.resource.data)
                $artifactPath += "\" + $artifactName
            }        
        }   
        else
        {  
            $artifactPath = ($artifact.resource.data)    
        }       

        if($artifactPath)
        {
            Write-Host "Artifact was found at: $artifactPath"
            #set build Artifact path
            Write-Host "Setting '$artifactPathVarName' to '$artifactPath'."
            Write-Host ("##vso[task.setvariable variable=$artifactPathVarName;]$artifactPath")
            Write-Host ("##vso[task.complete result=Succeeded;]DONE")
            [Environment]::SetEnvironmentVariable($artifactPathVarName, $artifactPath)
            break  
        }
    }

    if(!$artifactPath)
    {
        $err = "[Failed To: Get Build Artifacts] Artifact [$buildArtifactName] NOT found"
        Write-Error $err
        #Write-Host "##vso[task.logissue type=error;]$err"
    }
    else
    {
        #TODO call expand variables
        #Write-Host "Expanding the variable [$artifactPathVarName]..."
        #.\vsts-variable-expand.ps1 -VariableNames $artifactPathVarName
    }
}
Catch
{
    #[System.Exception]
    #if($Error[0].Exception -match "")
    #{
    #    Write-Warning "Failed to get build info, Please verify credentials"
    #    Write-Error "$($Error[0].Exception.Message)"
    #}
    Write-Error "$($Error[0].Exception.Message)"
}
Finally
{
    #default value for VariableNames is "*" (all build vars)
    Write-Output "Task execution Completed."
}


#################################################################################