param (
    [string]$chefServer,
    [string]$environment,
    [string]$attributes
    )

Write-Verbose "Chef Server = $chefServer" -Verbose
Write-Verbose "Environment = $environment" -Verbose
Write-Verbose "Attributes = $attributes" -Verbose

function Invoke-Knife()
{
    <#
        .SYNOPSIS
        Returns the output of knife command

        .PARAMETER argumets
        Arguments for knife command
    #>
    [CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string[]]$arguments
    )

    pushd $global:chefRepo
    try
    {
        $command = "knife "
        $arguments | foreach{ $command += "$_ " }
        $command = $command.Trim()
        Write-verbose "Running knife command: $command" -verbose
        iex $command
    }
    finally
    {
        popd
    }
}

function Wait-ForChefNodeRunsToComplete()
{
	[CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string]$environmentName,
		[Parameter(mandatory=$true)]
        [int]$runWaitTimeInMinutes,
		[Parameter(mandatory=$true)]
        [int]$pollingIntervalTimeInSeconds
    )

	$attributeUpdateTime = (Get-Date).ToUniversalTime();
	$allNodeRunsCompleted = $false;

	while(((Get-Date).ToUniversalTime() -lt $attributeUpdateTime.AddMinutes($runWaitTimeInMinutes)) `
	-and ($allNodeRunsCompleted -eq $false))
	{
		Write-Host "Waiting for runs to complete on all the nodes of the environment: $environment"
		$runListJson = Invoke-Knife @("runs list -E $environmentName -F json")
		$nodes = Invoke-Knife @("node list -E $environmentName;")

		$nodesCompletionTable = @{};
		foreach($node in $nodes)
		{
			$nodesCompletionTable.Add($node, $false);
		}

		$runArray = [Newtonsoft.Json.Linq.JArray]::Parse($runListJson);

		foreach($run in $runArray.GetEnumerator())
		{
			$nodeName = $run["node_name"].ToString();
			if($nodesCompletionTable.Contains($nodeName) `
			-and ([System.DateTime]::Parse($run["start_time"].ToString()) -gt $attributeUpdateTime))
			{
				$nodesCompletionTable[$nodeName] = $true            
			}
		}

		$allNodeRunsCompleted = $true;
		foreach($isCompleted in $nodesCompletionTable.Values)
		{
			if(-not $isCompleted)
			{
				$allNodeRunsCompleted = $false;
				break;        
			}
		}

		if(-not $allNodeRunsCompleted)
		{
			Start-Sleep -s $pollingIntervalTimeInSeconds
		}
	}

	Write-Host "Runs have completed on all the nodes in the environment: $environmentName"
}

function Invoke-GenericMethod
{
	param(
	$instance = $(throw “Please provide an instance on which to invoke the generic method”),
	[string] $methodName = $(throw “Please provide a method name to invoke”),
	[string[]] $typeParameters = $(throw “Please specify the type parameters”),
	[object[]] $methodParameters = $(throw “Please specify the method parameters”)
	)

	## Determine if the types in $set1 match the types in $set2, replacing generic
	## parameters in $set1 with the types in $genericTypes
	function ParameterTypesMatch([type[]] $set1, [type[]] $set2, [type[]] $genericTypes)
	{
		$typeReplacementIndex = 0
		$currentTypeIndex = 0

		## Exit if the set lengths are different
		if($set1.Count -ne $set2.Count)
		{
			return $false
		}

	## Go through each of the types in the first set
		foreach($type in $set1)
		{
			## If it is a generic parameter, then replace it with a type from
			## the $genericTypes list
			if($type.IsGenericParameter)
			{
				$type = $genericTypes[$typeReplacementIndex]
				$typeReplacementIndex++
			}

			## Check that the current type (i.e.: the original type, or replacement
			## generic type) matches the type from $set2
			if($type -ne $set2[$currentTypeIndex])
			{
				return $false
			}
			$currentTypeIndex++
		}

		return $true
	}

	## Convert the type parameters into actual types
	[type[]] $typedParameters = $typeParameters

	## Determine the type that we will call the generic method on. Initially, assume
	## that it is actually a type itself.
	$type = $instance

	## If it is not, then it is a real object, and we can call its GetType() method
	if($instance -isnot “Type”)
	{
		$type = $instance.GetType()
	}

	## Search for the method that:
	## – has the same name
	## – is public
	## – is a generic method
	## – has the same parameter types
	foreach($method in $type.GetMethods())
	{
		# Write-Host $method.Name
		if(($method.Name -eq $methodName) -and
		($method.IsPublic) -and
		($method.IsGenericMethod))
		{
			$parameterTypes = @($method.GetParameters() | % { $_.ParameterType })
			$methodParameterTypes = @($methodParameters | % { $_.GetType() })
			if(ParameterTypesMatch $parameterTypes $methodParameterTypes $typedParameters)
			{
				## Create a closed representation of it
				$newMethod = $method.MakeGenericMethod($typedParameters)

				## Invoke the method
				$newMethod.Invoke($instance, $methodParameters)

				return
			}
		}
	}

	## Return an error if we couldn’t find that method
	throw “Could not find method $methodName”

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
		Write-Verbose "Adding Newtonsoft.Json.dll as a type" -verbose
		$newtonPath = (resolve-path $path).path
		Add-Type -LiteralPath $newtonPath | Out-Null
		Write-Verbose "Added Newtonsoft.Json.dll as a type" -verbose
	}
	finally
	{
		popd
	}
}

$global:chefRepo = "$chefServer";

#this is the maximum wait time we will wait for the runs to happen on all nodes in the environment
$totalWaitTimeForRunsInMinutes = 30;

#this is the poll interval for checking in between runs
$pollIntervalForRunsInSeconds = 60;

#this is the relative path in Agent from the script to find Newtonsoft Json binary
$relativePathToNewtonsoft = "../../../Agent/Worker/Newtonsoft.Json.dll"

Add-NewtonsoftAsType $relativePathToNewtonsoft

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

	Write-Verbose "Environment attributes before modification:`n$jsonString" -verbose

	foreach ($attribute in $attributesTable.GetEnumerator())
	{
		$jsonObject.SelectToken($attribute.Key).Value = $attribute.Value	
	}

	$modifiedJsonString = $jsonObject.ToString();

	Write-Verbose "Environment attributes after modification:`n$modifiedJsonString" -verbose

	$environmentPath = join-path -Path $chefrepo "environments\'$environmentName.json"               
	
	Write-Verbose "Setting modified environment attributes at $environmentPath" -verbose
    Set-Content -Value $modifiedJsonString -Path $environmentPath
}

try
{
	Write-Verbose "Parsing environment attributes passed as key-value pairs" -verbose
	$attributesTable = Invoke-GenericMethod ([Newtonsoft.Json.JsonConvert]) DeserializeObject HashTable $attributes
	Write-Verbose "Parsed environment attributes" -verbose

    Invoke-Knife @("download environments/$environment.json")
    
	Update-LocalEnvironmentAttributes $attributesTable $environment

	Invoke-Knife @("upload environments/$environment.json")

	Wait-ForChefNodeRunsToComplete $environment $totalWaitTimeForRunsInMinutes $pollIntervalForRunsInSeconds
}
catch
{
    $errorMessage = $_.Exception.Message
    Write-Error $errorMessage
}