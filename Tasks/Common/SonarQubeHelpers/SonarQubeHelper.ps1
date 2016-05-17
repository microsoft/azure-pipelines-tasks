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


#
# If a build variable that represents a feature is set to true or false, return it. Otherwise, return the specified default.   
#
function IsFeatureEnabled
{
    param ([string]$featureSettingName, [bool]$enabledByDefault)
    
    $featureSettingValue = GetTaskContextVariable $featureSettingName
    
    if ($featureSettingValue -eq "true")
    {
        return $true
    }
    
    if ($featureSettingValue -eq "false")
    {
        return $false
    }
    
    return $enabledByDefault        
}

#
# Exit if the build is a PR build and PRCA is not enabled
#
function ExitOnPRBuild
{    
    if ((IsPrBuild) -and !(IsFeatureEnabled "SQPullRequestBot" $false))
    {
        Write-Host "SonarQube analysis is disabled during builds triggered by pull requests. Set a build variable named 'SQPullRequestBot' to 'true' to have the task post code analysis issues as comments in the PR. More information at http://go.microsoft.com/fwlink/?LinkID=786316"
        exit
    } 
}

#
# Compares the SonarQube server version with 5.2. Returns 0 is identical, >0 if greater, <0 if lower.
# Note that 5.2 introduces the async analysis mode resulting in major API changes. 
function CompareSonarQubeVersionWith52
{
    $versionString = GetOrFetchSonarQubeVersionString
    
    # Strip out '-SNAPSHOT' if it is present in version (developer versions of SonarQube might return version in this format: 5.2-SNAPSHOT)
    $sqServerVersion = ([string]$versionString).split("-")[0]

    $sqVersion = New-Object -TypeName System.Version -ArgumentList $sqServerVersion
    $sqVersion5dot2 = New-Object -TypeName System.Version -ArgumentList "5.2"
    
    return $sqVersion.CompareTo($sqVersion5dot2)
}

#
# Helper that returns the version number of the SonarQube server
#
function GetOrFetchSonarQubeVersionString
{         
    $versionString = GetTaskContextVariable "MSBuild.SonarQube.Internal.ServerVersion"
    if ([String]::IsNullOrEmpty($versionString))
    {
         $command = {InvokeGetRestMethod "/api/server/version" }
         $versionString = Retry $command -maxRetries 2 -retryDelay 1 -Verbose
         SetTaskContextVariable "MSBuild.SonarQube.Internal.ServerVersion" $versionString
    }
    
    Assert (![String]::IsNullOrEmpty($versionString)) "Could not retrieve the SonarQube server version"
    
    Write-Verbose "The SonarQube server version is $versionString"

    return $versionString
}