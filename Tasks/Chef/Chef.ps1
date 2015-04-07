param (
    [string]$connectedServiceName,
    [string]$environment,
    [string]$attributes,
	[string]$chefWaitTime
    )

Write-Verbose "ConnectedServiceName = $connectedServiceName" -Verbose
Write-Verbose "Environment = $environment" -Verbose
Write-Verbose "Attributes = $attributes" -Verbose
Write-Verbose "Wait Time = $chefWaitTime" -Verbose

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

function Validate-EnvironmentInput()
{
	[CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string[]]$environmentName
    )

	$environmentsList = Invoke-Knife @("environment list")
	if(-not $environmentsList.Contains($environmentName))
	{
		throw "Environment name `"$environment`" is not found on the chef server"	
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

	Write-Verbose "Parsing environment attributes passed as key-value pairs" -verbose
	try
	{
		$attributesTable = Invoke-GenericMethod ([Newtonsoft.Json.JsonConvert]) DeserializeObject HashTable $attributesString
	}
	catch
	{
		throw "Give the environment attribute key value pairs to be updated as proper json. ex: {`"default_attributes.websiteName`":`"MyWebsite`",`"override_attributes.db`":`"MyDb`"}"	
	}

	Write-Verbose "Parsed environment attributes" -verbose
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

	throw "Please provide a valid ""Wait Time"" input in minutes. It should be an integer greater than 0."
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

	$driftInSeconds = 30;
	$attributeUpdateTime = (Get-Date).ToUniversalTime();
	$attributeUpdateTimeWithDrift = $attributeUpdateTime.AddSeconds($driftInSeconds)
	$allNodeRunsCompleted = $false;
	$failureNodesList = @();
	$successNodesList = @();
	$noRunsNodeList = @();
	$nodes = Invoke-Knife @("node list -E $environmentName")
	$nodesCompletionTable = @{};
	foreach($node in $nodes)
	{
		$nodesCompletionTable.Add($node, $false);
	}
	
	Write-Host "Waiting for runs to complete on all the nodes of the environment: $environmentName"

	while(((Get-Date).ToUniversalTime() -lt $attributeUpdateTime.AddMinutes($runWaitTimeInMinutes)) `
	-and ($allNodeRunsCompleted -eq $false))
	{
		$runListJson = Invoke-Knife @("runs list -E $environmentName -F json")
		$runArray = [Newtonsoft.Json.Linq.JArray]::Parse($runListJson);

		#TODO: might remove this, added to check E2E failure intermittent
		Write-Verbose $runArray.ToString() -verbose

		foreach($run in $runArray.GetEnumerator())
		{
			$nodeName = $run["node_name"].ToString();
			if($nodesCompletionTable.Contains($nodeName) `
			-and (-not $nodesCompletionTable[$nodeName]) `
			-and ([System.DateTime]::Parse($run["start_time"].ToString()) -gt $attributeUpdateTimeWithDrift))
			{
				$runStatus = $run["status"].ToString();
				$runId = $run["run_id"].ToString();

				if($runStatus -eq "failure")
				{
					$runString = Get-DetailedRunHistory $runId
					Write-Error "Run on node $nodeName has failed. Check logs below:`n$($runString | out-string)" -EA "Continue"
					$failureNodesList += $nodeName
					$nodesCompletionTable[$nodeName] = $true
				}
				elseif($runStatus -eq "success")
				{
					Write-Host "Run on node $nodeName has succeeded. run_id:$runId"
					$successNodesList += $nodeName
					$nodesCompletionTable[$nodeName] = $true
				}
				else
				{
					#InProgress condition which is equivalent to no run on node, no-op
			}
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

	if($allNodeRunsCompleted)
	{
		Write-Host "Runs have completed on all the nodes in the environment: $environmentName"
	}
	else
	{
		foreach($nodeCompletionData in $nodesCompletionTable.GetEnumerator())
		{
			if($nodeCompletionData.Value -eq $false)
			{
				$noRunsNodeList += $nodeCompletionData.Name
			}
		}

		Write-Host "Runs have not completed on all the nodes in the environment: $environmentName"
		$noRunsNodeListString = $noRunsNodeList -join "`n"
		Write-Host "Runs have not completed on the following nodes:`n$noRunsNodeListString"
	}

	if($successNodesList.Count -gt 0)
	{
		Write-Host "Runs have reported ""success"" status on the following nodes:`n$($successNodesList -join ""`n"")"
	}

	if(($failureNodesList.Count -gt 0) -or (-not $allNodeRunsCompleted))
	{
		if($failureNodesList.Count -eq 0)
		{
			Write-Host "Chef deployment has failed because chef runs have not completed on all the nodes in the environment.
			However, there were no chef run failures. Consider increasing wait time for chef runs to complete, 
			and check nodes if they are reachable from chef server and able to pull the recipes from the chef server."
		}
		else
		{
			Write-Host "Runs have reported ""failure"" status on the following nodes:`n$($failureNodesList -join ""`n"")"
		}

		throw "Chef deployment has failed on the environment: $environmentName"
	}
	else
	{
		Write-Host "Chef deployment has succeeded on the environment: $environmentName. All node runs in the environment have reported ""success"" state."
	}
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

	Write-Verbose "Environment attributes before modification:`n$jsonString" -verbose

	foreach ($attribute in $attributesTable.GetEnumerator())
	{
		if($jsonObject.SelectToken($attribute.Key) -eq $null)
		{
			throw "Cannot find environment attribute with key: $($attribute.Key)"
		}

		$jsonObject.SelectToken($attribute.Key).Value = $attribute.Value	
	}

	$modifiedJsonString = $jsonObject.ToString();

	Write-Verbose "Environment attributes after modification:`n$modifiedJsonString" -verbose

	$environmentPath = join-path -Path $chefrepo "environments\$environmentName.json"               
	
	Write-Verbose "Setting modified environment attributes at $environmentPath" -verbose
    Set-Content -Value $modifiedJsonString -Path $environmentPath
}

function Setup-ChefRepo()
{
	[CmdletBinding()]
    Param
    (
		[Parameter(mandatory=$true)]
        [string]$connectedServiceName
    )

    Write-Verbose "Creating Chef Repo" -verbose
    $connectedServiceDetails = Get-ConnectedServiceDetails -Context $distributedTaskContext -ConnectedServiceName $connectedServiceName

    [xml]$credentialsXml = $connectedServiceDetails.CredentialsXml
    $userName = $credentialsXml.Credentials.UserName
    Write-Verbose "userName = $userName" -Verbose
    $passwordKey = $credentialsXml.Credentials.PasswordKey
    $organizationUrl = $connectedServiceDetails.EndPoint
    Write-Verbose "organizationUrl = $organizationUrl" -Verbose
    
    #create temporary chef repo
    $randomGuid=[guid]::NewGuid()
    $chefRepoPath = Join-Path -Path $env:temp -ChildPath $randomGuid
    $global:chefRepo = "$chefRepoPath"
    New-Item $chefRepoPath -type Directory | Out-Null

    #create knife config directory
    $knifeConfigDirectoryPath = Join-Path -Path $chefRepoPath -ChildPath ".chef"
    New-Item $knifeConfigDirectoryPath -type Directory | Out-Null

    #create knife.rb
    $knifeConfigPath = Join-Path -Path $knifeConfigDirectoryPath -ChildPath "knife.rb"
    New-Item $knifeConfigPath -type File | Out-Null

    #create passwordKey File
    $privateKeyFileName = $userName + ".pem"
    $privateKeyFilePath = Join-Path -Path $knifeConfigDirectoryPath -ChildPath $privateKeyFileName
    New-Item $privateKeyFilePath -type File -value $passwordKey | Out-Null

    Invoke-Knife @("configure --repository '$chefRepoPath' --server-url '$organizationUrl' --user '$userName' --validation-client-name '$userName'  --validation-key '$privateKeyFileName' --config '$knifeConfigPath' --yes") | Out-Null

    Write-Verbose "Chef Repo Created" -verbose
}

########################  EXECUTION STARTS HERE  #################################
try
{
	#setting error action preference
	$ErrorActionPreference = "Stop"

	#setting up chef repo after fetching chef subscription details
    Setup-ChefRepo $connectedServiceName

	#this is the poll interval for checking in between runs
	$pollIntervalForRunsInSeconds = 60;

	#this is the relative path in Agent from the script to find Newtonsoft Json binary
	$relativePathToNewtonsoft = "$env:AGENT_HOMEDIRECTORY/Agent/Worker/Newtonsoft.Json.dll"

	Add-NewtonsoftAsType $relativePathToNewtonsoft

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
        Write-Verbose "Deleting Chef Repo" -verbose
        Remove-Item -Recurse -Force $global:chefRepo
        Write-Verbose "Chef Repo Deleted" -verbose
    }
}
########################  END EXECUTION  #################################