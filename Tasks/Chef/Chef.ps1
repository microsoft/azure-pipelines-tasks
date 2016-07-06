param (
    [string]$connectedServiceName,
    [string]$environment,
    [string]$attributes,
	[string]$chefWaitTime
    )

Write-Verbose "ConnectedServiceName = $connectedServiceName"
Write-Verbose "Environment = $environment"
Write-Verbose "Attributes = $attributes"
Write-Verbose "Wait Time = $chefWaitTime"

function Validate-EnvironmentInput()
{
	[CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string]$environmentName
    )

	$environmentsList = Invoke-Knife @("environment list")
	if(-not $environmentsList.Contains($environmentName))
	{
        throw (Get-LocalizedString -Key "Environment name '{0}' is not found on the chef server" -ArgumentList $environment)
	}

    $nodesList = Invoke-Knife @("node list -E $environmentName")
    if([string]::isNullOrEmpty($nodesList))
    {
        throw (Get-LocalizedString -Key "The chef environment '{0}' has no nodes in it" -ArgumentList $environment)	
    }
}

function Validate-AttributesInput()
{
	[CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string[]]$attributesString
    )

	Write-Verbose "Parsing environment attributes passed as key-value pairs"
	try
	{
		$attributesTable = Invoke-GenericMethod ([Newtonsoft.Json.JsonConvert]) DeserializeObject HashTable $attributesString
	}
	catch
	{
        throw (Get-LocalizedString -Key "Give the environment attribute key value pairs to be updated as proper json. ex: '{0}'" -ArgumentList "{`"default_attributes.websiteName`":`"MyWebsite`",`"override_attributes.db`":`"MyDb`"}")
	}

	Write-Verbose "Parsed environment attributes"
	return $attributesTable
}

function Validate-WaitTime()
{
	[CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string[]]$runLockTimeoutString
    )

	$parsedRunLockTimeout = $null
	if([int32]::TryParse($runLockTimeoutString , [ref]$parsedRunLockTimeout))
	{
		if($parsedRunLockTimeout -gt 0)
		{
			return $parsedRunLockTimeout
		}
	}

    throw (Get-LocalizedString -Key "Please provide a valid '{0}' input in minutes. It should be an integer greater than 0" -ArgumentList 'Wait Time')
}

function Add-NewtonsoftAsType()
{
	[CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string]$path
    )

	pushd $PSScriptRoot
	try
	{
		Write-Verbose "Adding Newtonsoft.Json.dll as a type"
		$newtonPath = (resolve-path $path).path
		Add-Type -LiteralPath $newtonPath | Out-Null
		Write-Verbose "Added Newtonsoft.Json.dll as a type"
	}
	finally
	{
		popd
	}
}

function Get-DetailedRunHistory()
{
	[CmdletBinding()]
	Param
    (
		[Parameter(mandatory=$true)]
        [string]$runIdString
    )

	return Invoke-knife @("runs show $runId")
}

function Update-LocalEnvironmentAttributes()
{
	[CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [HashTable]$attributesTable,
		[Parameter(mandatory=$true)]
        [string]$environmentName
    )

	$jsonString = [string](Invoke-Knife @("environment show '$environmentName' -z -F json"))
    $jsonObject = [Newtonsoft.Json.Linq.JObject]::Parse($jsonString)

	Write-Verbose "Environment attributes before modification:`n$jsonString"

	foreach ($attribute in $attributesTable.GetEnumerator())
	{
		if($jsonObject.SelectToken($attribute.Key) -eq $null)
		{
            throw (Get-LocalizedString -Key "Cannot find environment attribute with key: '{0}'" -ArgumentList $attribute.Key)
		}
		
		if(-not ($jsonObject.SelectToken($attribute.Key).Value -is [String]))
		{
            throw (Get-LocalizedString -Key "The attribute with key: '{0}' is not a leaf attribute" -ArgumentList $attribute.Key)		
		}

		$jsonObject.SelectToken($attribute.Key).Value = $attribute.Value	
	}

	$modifiedJsonString = $jsonObject.ToString();

	Write-Verbose "Environment attributes after modification:`n$modifiedJsonString" -verbose

	$environmentPath = join-path -Path $chefrepo "environments\$environmentName.json"               
	
	Write-Verbose "Setting modified environment attributes at $environmentPath" -verbose
    Set-Content -Value $modifiedJsonString -Path $environmentPath
}

########################  EXECUTION STARTS HERE  #################################
try
{
	#setting error action preference
	$ErrorActionPreference = "Stop"

    import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
    Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Chef"

    #fetching chef subscription details
    $connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName

	#setting up chef repo with the chef subscription details fetched before
    Initialize-ChefRepo $connectedServiceDetails

	#this is the poll interval for checking in between runs
	$pollIntervalForRunsInSeconds = 60;

	Add-NewtonsoftAsType (Get-PathToNewtonsoftBinary)

	Validate-EnvironmentInput $environment

	$attributesTable = Validate-AttributesInput $attributes

	$totalWaitTimeForRunsInMinutes = Validate-WaitTime $chefWaitTime

	Invoke-Knife @("download environments/$environment.json")

	Update-LocalEnvironmentAttributes $attributesTable $environment

	Invoke-Knife @("upload environments/$environment.json")

	Wait-ForChefNodeRunsToComplete $environment $totalWaitTimeForRunsInMinutes $pollIntervalForRunsInSeconds
}
finally
{
    #delete temporary chef repo
    if ([string]::IsNullOrEmpty($global:chefRepo) -eq $false)
    {
        Write-Verbose "Deleting Chef Repo"
        #adding this as knife sometimes takes hold of the repo for a little time before deleting
        $deleteChefRepoScript = 
        { 
            Remove-Item -Recurse -Force $global:chefRepo 
        }

        Invoke-WithRetry -Command $deleteChefRepoScript -RetryDelay 10 -MaxRetries 10 -OperationDetail "deleting chef repo"
        Write-Verbose "Chef Repo Deleted"
    }
}
########################  END EXECUTION  #################################