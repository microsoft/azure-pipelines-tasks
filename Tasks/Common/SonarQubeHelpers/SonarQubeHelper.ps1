###############################################################################################
### Note: This file should be kept in sync with the SonarQubeHelper.ps1 from the "end task"####
###############################################################################################


# When passing arguments to a process, the quotes need to be doubled and   
# the entire string needs to be placed inside quotes to avoid issues with spaces  
function EscapeArg  
{  
    param([string]$argVal)  
  
    $argVal = $argVal.Replace('"', '""');  
    $argVal = '"' + $argVal + '"';  
  
    return $argVal;  
}  


# Set a variable in a property bag that is accessible by all steps
# To retrieve the variable use $val = Get-Variable $distributedTaskContext "varName"
function SetTaskContextVariable
{
    param([string][ValidateNotNullOrEmpty()]$varName, 
          [string]$varValue)
    
    Write-Host "##vso[task.setvariable variable=$varName;]$varValue"
}

function GetTaskContextVariable()
{
	param([string][ValidateNotNullOrEmpty()]$varName)
	return Get-TaskVariable -Context $distributedTaskContext -Name $varName
}

#
# Helper that informs if a "filePath" has been specified. The platform will return the root of the repo / workspace if the user enters nothing.
#
function IsFilePathSpecified
{
     param([string]$path)

     if ([String]::IsNullOrWhiteSpace($path))
     {
        return $false
     }

     return ![String]::Equals(
                [System.IO.Path]::GetFullPath($path).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar),
                [System.IO.Path]::GetFullPath($env:BUILD_SOURCESDIRECTORY).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar),
                [StringComparison]::OrdinalIgnoreCase)
}


#
# Retry a specific command until it completes without exceptions. Throws if the command didn't complete successfully after the specified number of retries. Usage:  
#
#   $command = { InvokeGetRestMethod "/api/projects"} 
#   Retry $command -maxRetries 30 -retryDelay 1 -Verbose
#
function Retry
{
    [CmdletBinding()]
    param (    
    [Parameter(ValueFromPipeline,Mandatory)]$command,
    [int]$maxRetries = 3, 
    [int]$retryDelay = 1)    

    $success = $false
    $attemptNumber = 1

    while (!$success)
    {
        try
        {
            Write-Verbose "Calling $command"
            $result = & $command
            $success = $true
        }
        catch
        {
            if ($attemptNumber -ige $maxRetries) 
            {
                Write-Verbose "Calling $command failed after $attemptNumber retries"
                throw
            }
            else
            {
                Write-Verbose "Calling $command failed. Attempt number $attemptNumber. Retrying after $retryDelay seconds..."
                Start-Sleep $retryDelay
                $attemptNumber++
            }
        }
    }

    return $result
}

#
# Retry a specific command until the results is true. Returns true if the command succeded. Timeout and retry delay are in seconds. Usage:  
#
#   $command = { GetStatus -eq "Complete" } 
#   RetryUntilTrue $command -timeout 60 -retryDelay 1 -Verbose
# 
#
function RetryUntilTrue
{    
    param (    
        [Parameter(ValueFromPipeline,Mandatory)]$command,        
        [int]$timeout = 60, 
        [int]$retryDelay = 1)    

    $sw =  New-Object -TypeName "System.Diagnostics.Stopwatch"
    $sw.Start()
    $success = $false    

    while (!$success)
    {
       
       Write-Verbose "Calling $command"
       $success = & $command
       
       if (!$success)
       {
            $elapsedTime = $sw.Elapsed.TotalSeconds;

            if ($elapsedTime -gt $timeout) 
            {
                 Write-Verbose "Calling $command failed after $elapsedTime seconds"
                 return $false;
            }
            else
            {
                Write-Verbose "Calling $command failed. Elapsed time $elapsedTime seconds. Retrying after $retryDelay seconds..."
                Start-Sleep $retryDelay                
            }
       }              
    }  

    return $true;  
}

function InvokeGetRestMethod
{
    param (
        [Parameter(Mandatory=$true)][string]$query, 
        [bool]$useAuth=$false)

                
    $sonarQubeHostUrl = GetTaskContextVariable "MSBuild.SonarQube.HostUrl"     
    $sonarQubeHostUrl  = $sonarQubeHostUrl.TrimEnd("/");

    Assert (![System.String]::IsNullOrWhiteSpace($sonarQubeHostUrl)) "Could not retrieve the SonarQube host url"

    $request = $sonarQubeHostUrl + $query;
    
    if ($useAuth)
    {      
       $authHeader = CreateBasicAuthHeaderFromEndpoint

       if (![String]::IsNullOrWhiteSpace($authHeader))
       {
            $allheaders = @{Authorization = $authHeader}        
       }
       
    }  

    $response = Invoke-RestMethod -Uri $request -Method Get -Headers $allheaders

    return $response
}

#
# Creates a basic authentication header using the credentials specified in the generic endpoint in the begin task. 
#
function CreateBasicAuthHeaderFromEndpoint
{                                   
    $user = GetTaskContextVariable "MSBuild.SonarQube.ServerUsername" 
    $password = GetTaskContextVariable "MSBuild.SonarQube.ServerPassword"             

    if ($user -or $password)
    {
        $pair = "$($user):$($password)"
    
        $encodedCreds = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($pair))
        $basicAuthValue = "Basic $encodedCreds"
    }
    
    return $basicAuthValue        
}

#
# C# like assert based on a condition. Note that PowerShell does not support actual assertions so 
# 
function Assert
{
    param ([bool]$condition, [string]$message)

    if (!$condition)
    {
        throw $message
    }
}

#
# Returns true if this build was triggered in response to a PR
#
# Remark: this logic is temporary until the platform provides a more robust way of determining PR builds; 
# Note that PR builds are only supported on TfsGit
#
function IsPrBuild
{    
    $sourceBranch = $env:Build_SourceBranch
    $scProvider = $env:Build_Repository_Provider

    return   $scProvider -and `
             ($scProvider -eq "TfsGit") -and `
             $sourceBranch -and `
             $sourceBranch.StartsWith("refs/pull/", [StringComparison]::OrdinalIgnoreCase)        
}


function GetSonarQubeBuildDirectory
{
    $agentBuildDirectory = GetTaskContextVariable "Agent.BuildDirectory"
	if (!$agentBuildDirectory)
	{
		throw "Could not retrieve the Agent.BuildDirectory variable";
	}

	return [System.IO.Path]::Combine($agentBuildDirectory, ".sonarqube");
}


function GetSonarQubeOutDirectory
{
    $sqBuildDir = GetSonarQubeBuildDirectory
    
    return [System.IO.Path]::Combine($sqBuildDir, "out");
}

function GetSonarScannerDirectory
{
    $sqBuildDir = GetSonarQubeOutDirectory
    
    return [System.IO.Path]::Combine($sqBuildDir, ".sonar");
}


