
function CreateCommandLineArgs
{
    param(
          [ValidateNotNullOrEmpty()][string]$projectKey,
          [ValidateNotNullOrEmpty()][string]$projectName,
          [ValidateNotNullOrEmpty()][string]$projectVersion,
          [string]$serverUrl,
	      [string]$serverUsername,
		  [string]$serverPassword,
		  [string]$dbUrl,
		  [string]$dbUsername,
		  [string]$dbPassword,
          [string]$aditionalArguments,
          [string]$configFile)
	

    $sb = New-Object -TypeName "System.Text.StringBuilder"; 

    # Append is a fluent API, i.e. it returns the StringBuilder. However powershell will return capture the data and use it in the return value.
    # To avoid this, force it to ignore the Append return value using [void]
    [void]$sb.Append("begin");

    [void]$sb.Append(" /k:""$projectKey"" /n:""$projectName"" /v:""$projectVersion""");

    if (![String]::IsNullOrWhiteSpace($serverUrl))
    {    
        [void]$sb.Append(" /d:sonar.host.url=""$serverUrl""")
    }

    if (![String]::IsNullOrWhiteSpace($serverUsername))
    {
        [void]$sb.Append(" /d:sonar.login=""$serverUsername""")
    }

    if (![String]::IsNullOrWhiteSpace($serverPassword))
    {
        [void]$sb.Append(" /d:sonar.password=""$serverPassword""")
    }

    if (![String]::IsNullOrWhiteSpace($dbUrl))
    {
        [void]$sb.Append(" /d:sonar.jdbc.url=""$dbUrl""")
    }

    if (![String]::IsNullOrWhiteSpace($dbUsername))
    {
        [void]$sb.Append(" /d:sonar.jdbc.username=""$dbUsername""")
    }

    if (![String]::IsNullOrWhiteSpace($dbPassword))
    {
        [void]$sb.Append(" /d:sonar.jdbc.password=""$dbPassword""")
    }

    if (![String]::IsNullOrWhiteSpace($aditionalArguments))
    {
        [void]$sb.Append(" " + $aditionalArguments)
    }

    if (IsFilePathSpecified $configFile)
    {
        if (![System.IO.File]::Exists($configFile))
        {
            throw "Could not find the specified configuration file: $configFile" 
        }

        [void]$sb.Append(" /s:$configFile")
    }

    return $sb.ToString();
}

# Set a variable in a property bag that is accessible by all steps
# To retrieve the variable use $val = Get-Variable $distributedTaskContext "varName"
function SetTaskContextVaraible
{
    param([string][ValidateNotNullOrEmpty()]$varName, 
          [string][ValidateNotNullOrEmpty()]$varValue)
    
    Write-Host "##vso[task.setvariable variable=$varName;]$varValue"
}

# Retrieves the url, username and password from the specified generic endpoint.
# Only UserNamePassword authentication scheme is supported for SonarQube.
function GetEndpointData
{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)

	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName

	if (!$serviceEndpoint)
	{
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}

	$authScheme = $serviceEndpoint.Authorization.Scheme
	if ($authScheme -ne 'UserNamePassword')
	{
		throw "The authorization scheme $authScheme is not supported for a SonarQube server."
	}

    return $serviceEndpoint
}


################# Helpers ######################

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

