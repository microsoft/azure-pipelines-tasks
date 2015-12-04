function Write-TaskSpecificTelemetry
{
    param(
      [string]$codeKey
      )

    Write-Telemetry "$codeKey" "94A74903-F93F-4075-884F-DC11F34058B4"
}

function Validate-AzurePowershellVersion
{
    $currentVersion =  Get-AzureCmdletsVersion
    $minimumAzureVersion = New-Object System.Version(0, 9, 0)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    if(!$versionCompatible)
    {
        Write-TaskSpecificTelemetry "PREREQ_UnsupportedAzurePSVerion"
        Throw (Get-LocalizedString -Key "The required minimum version {0} of the Azure Powershell Cmdlets are not installed. You can follow the instructions at {1} to get the latest Azure powershell" -ArgumentList $minimumAzureVersion, "http://aka.ms/azps")    }

    Write-Verbose -Verbose "Validated the required azure powershell version"
}

function Is-SwitchAzureModeRequired
{
    $currentVersion =  Get-AzureCmdletsVersion
    $minimumAzureVersion = New-Object System.Version(0, 9, 9)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    if(!$versionCompatible)
    {
        Write-Verbose -Verbose "Switch Azure Mode is required"
        return $true
    }
    
    if(!(Get-Module -Name "AzureRM" -ListAvailable))
    {
        Write-TaskSpecificTelemetry "PREREQ_AzureRMModuleNotFound"
        throw (Get-LocalizedString -Key "The required AzureRM Powershell module is not installed. You can follow the instructions at {0} to get the latest Azure powershell" -ArgumentList "http://aka.ms/azps")
    }
       
    return $false
}

function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
        throw (Get-LocalizedString -Key "Found more than one file to deploy with search pattern '{0}'. There can be only one" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
            throw (Get-LocalizedString -Key "No files were found to deploy with search pattern '{0}'" -ArgumentList $pattern)
        }

        return $files
    }
}

function Get-File($pattern)
{
    #Find the File based on pattern
    Write-Verbose -Verbose "Finding files based on $pattern"
    $filesMatchingPattern = Find-Files -SearchPattern "$pattern"

    Write-Verbose -Verbose "Files Matching Pattern: $filesMatchingPattern"

    #Ensure that at most a single file is found
    $file = Get-SingleFile $filesMatchingPattern $pattern

    return $file
}

function Validate-DeploymentFileAndParameters
{
    param([string]$csmFile,
          [string]$csmParametersFile)

    if (!(Test-Path -Path $csmFile -PathType Leaf))
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
        throw (Get-LocalizedString -Key "Please specify a complete and a valid template file path")
    }

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:BUILD_SOURCESDIRECTORY, "\") -and !(Test-Path -Path $csmParametersFile -PathType Leaf))
    {
         Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
         throw (Get-LocalizedString -Key "Please specify a complete and a valid template parameters file path")
    }
}

function Get-CsmParameterObject
{
    param([string]$csmParameterFileContent,
          [string]$overrideParameters)

	$newParametersObject = New-Object System.Collections.Hashtable([System.StringComparer]::InvariantCultureIgnoreCase)
    if ([string]::IsNullOrEmpty($csmParameterFileContent) -eq $false)
    {
        Write-Verbose "Generating csm parameter object" -Verbose

        $csmJObject = [Newtonsoft.Json.Linq.JObject]::Parse($csmParameterFileContent)

        if($csmJObject.ContainsKey("parameters") -eq $true)
        {
            $parameters = $csmJObject.GetValue("parameters")
            $parametersObject  = $parameters.ToObject([System.Collections.Hashtable])
        }
        else
        {
            $parametersObject = $csmJObject.ToObject([System.Collections.Hashtable])
        }

        foreach($key in $parametersObject.Keys)
        {
            $parameterValue = $parametersObject[$key] -as [Newtonsoft.Json.Linq.JObject]
            $newParametersObject.Add($key, $parameterValue["value"].ToString())
        }

        Write-Verbose "Generated the parameter object" -Verbose
	}
		
    if([string]::IsNullOrEmpty($overrideParameters) -eq $false)
    {
        Write-Verbose "Overriding parameter objects" -Verbose
        $overrideParametersList = $overrideParameters.Split(" ")
		$i = 0
        While($i -lt $overrideParametersList.Count)
        {
            if([string]::IsNullOrEmpty($overrideParametersList[$i]) -eq $true)
            {
                $i = $i + 1
                continue
            }
            $parameterName = $overrideParametersList[$i]
			if(!$parameterName.StartsWith("-"))
            {
			    Write-TaskSpecificTelemetry "PREREQ_InvalidInputFormat"
                Throw (Get-LocalizedString -Key  "Provided Override parameter format is invalid. Please provide Override parameters in this format: -parame1 value1 -parame2 `"value  with  space`".")
            }
			
			$parameterName = $parameterName.TrimStart("-")
			
            $parameterValue = $overrideParametersList[$i + 1]
            $i = $i + 2

			if([string]::IsNullOrEmpty($parameterValue) -eq $true)
            {
			    Write-TaskSpecificTelemetry "PREREQ_InvalidInputFormat"
                Throw (Get-LocalizedString -Key  "Provided Override parameter format is invalid. Please provide Override parameters in this format: -parame1 value1 -parame2 `"value  with  space`".")
            }
			if($parameterValue.StartsWith("`""))
			{
			    While(!$parameterValue.EndsWith("`"") -and $i -lt $overrideParametersList.Count)
                {
					$ParamValueSuffix = $overrideParametersList[$i]
					$parameterValue = "$parameterValue $ParamValueSuffix"
					$i = $i + 1
				}
				
				if(!$parameterValue.EndsWith("`""))
				{
				    Write-TaskSpecificTelemetry "PREREQ_InvalidInputFormat"
				    Throw (Get-LocalizedString -Key  "Provided Override parameter format is invalid. Please provide Override parameters in this format: -parame1 value1 -parame2 `"value  with  space`".")
				}
			}
            
			
            if($newParametersObject.ContainsKey($parameterName))
            {
                $newParametersObject[$parameterName] = ($parameterValue).Trim("`"")
            }
            else
            {
                $newParametersObject.Add($parameterName, $parameterValue)
            }
        }
		
        Write-Verbose "Overriding parameter objects completed." -Verbose
    }
	
    if($newParametersObject.Count -eq 0)
    {
        return $null
    }
    return $newParametersObject
}

function Perform-Action
{
    param([string]$action,
          [string]$resourceGroupName)

    Switch ($Action)
    {
          { @("Start", "Stop", "Restart", "Delete") -contains $_ } {
             Invoke-OperationHelper -resourceGroupName $resourceGroupName -operationName $action
             break
          }

          "DeleteRG" {
             Delete-MachineGroupHelper -resourceGroupName $resourceGroupName
             break
          }

         default {
		    Write-TaskSpecificTelemetry "PREREQ_InvalidActionProvided"
		    throw (Get-LocalizedString -Key "Action '{0}' is not supported on the provider '{1}'" -ArgumentList $action, "Azure")
		 }
    }
}

function Invoke-OperationHelper
{
     param([string]$resourceGroupName,
           [string]$operationName)

    Write-Verbose "Entered perform action $operationName on machines for resource group $resourceGroupName" -Verbose

    $machines = Get-AzureMachinesInResourceGroup -resourceGroupName $resourceGroupName

    if(! $machines)
    {
        Write-Verbose "Resource group $resourceGroupName has no machines in it" -Verbose
        return
    }

    Foreach($machine in $machines)
    {
        $machineName = $machine.Name
        $response = Invoke-OperationOnProvider -resourceGroupName $resourceGroupName -machineName $machine.Name -operationName $operationName

        if($response.Status -ne "Succeeded")
        {
		    Write-TaskSpecificTelemetry "DEPLOYMENT_PerformActionFailed"
            Write-Error (Get-LocalizedString -Key "Operation '{0}' failed on the machine '{1}'" -ArgumentList $operationName, $machine.Name)
            throw $response.Error
        }
        else
        {
            Write-Verbose "'$operationName' operation on the machine '$machineName' succeeded" -Verbose
        }
        
        Write-Verbose "Call to provider to perform operation '$operationName' on the machine '$machineName' completed" -Verbose
    }
}

function Invoke-OperationOnProvider
{
    param([string]$resourceGroupName,
          [string]$machineName,
          [string]$operationName)
    
    # Performs the operation on provider based on the operation name.
    Switch ($operationName)
    {
         "Start" {
             $response = Start-MachineInProvider -resourceGroupName $resourceGroupName -machineName $machineName
         }

         "Stop" {
             $response = Stop-MachineInProvider -resourceGroupName $resourceGroupName -machineName $machineName
         }

         "Restart" {            
             $response = Stop-MachineInProvider -resourceGroupName $resourceGroupName -machineName $machineName             

             if($response.Status -eq "Succeeded")
             {
                $response = Start-MachineInProvider -resourceGroupName $resourceGroupName -machineName $machineName
             }         
         }

         "Delete" {
             $response = Delete-MachineFromProvider -resourceGroupName $resourceGroupName -machineName $machineName
         }

         default {
              Write-TaskSpecificTelemetry "PREREQ_InvalidActionProvided"
              throw (Get-LocalizedString -Key "Tried to invoke an invalid operation: '{0}'" -ArgumentList $operationName)
         }         
    }

    $response
}

function Delete-MachineGroupHelper
{
    param([string]$resourceGroupName)

    Write-Verbose "Entered delete resource group helper for resource group $resourceGroupName" -Verbose

    Delete-MachineGroupFromProvider -resourceGroupName $resourceGroupName
}

function Get-CsmAndParameterFiles
{
    param([string] $csmFile,
          [string] $csmParametersFile)

    #Find the matching deployment definition File
    $csmFile = Get-File $csmFile
    Write-Verbose -Verbose "deploymentDefinitionFile = $csmFile"

    # csmParametersFile value would be  BUILD_SOURCESDIRECTORY when left empty in UI.
    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:BUILD_SOURCESDIRECTORY, "\"))
    {
        #Find the matching deployment definition Parameter File
        $csmParametersFile = Get-File $csmParametersFile
        Write-Verbose -Verbose "deploymentDefinitionParametersFile = $csmParametersFile"
    }

    Validate-DeploymentFileAndParameters -csmFile $csmFile -csmParametersFile $csmParametersFile

    @{"csmFile" = $($csmFile); "csmParametersFile" = $($csmParametersFile)}
}

function Create-AzureResourceGroupHelper
{
    param([string] $csmFile,
          [string] $csmParametersFile,
          [string] $resourceGroupName,
          [string] $location,
          [string] $overrideParameters,
          [bool] $isSwitchAzureModeRequired)

    $csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)

    #Create csm parameter object
    $csmAndParameterFiles = Get-CsmAndParameterFiles -csmFile $csmFile -csmParametersFile $csmParametersFile

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:BUILD_SOURCESDIRECTORY, "\"))
    {
        $csmParametersFileContent = [System.IO.File]::ReadAllText($csmAndParameterFiles["csmParametersFile"])
    }
    else
    {
        $csmParametersFileContent = [String]::Empty
    }

    $parametersObject = Get-CsmParameterObject -csmParameterFileContent $csmParametersFileContent -overrideParameters $overrideParameters

    # Create azure resource group
    $resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmAndParameterFiles["csmFile"] -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location -isSwitchAzureModeRequired $isSwitchAzureModeRequired        
}

function Instantiate-Environment
{
    param([string]$resourceGroupName,
          [string]$outputVariable)    

    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    if($isSwitchAzureModeRequired)
    {
        Write-Verbose "Switching Azure mode to AzureServiceManagement" -Verbose
        Switch-AzureMode AzureServiceManagement
    }

    $azureVMResources = Get-AzureClassicVMsInResourceGroup -resourceGroupName $resourceGroupName
    Get-MachineConnectionInformationForClassicVms -resourceGroupName $resourceGroupName

    if($azureVMResources.Count -eq 0)
    {
        if($isSwitchAzureModeRequired)
        {
            Write-Verbose "Switching Azure mode to AzureResourceManager." -Verbose
            Switch-AzureMode AzureResourceManager
        }

        $azureVMResources = Get-AzureVMsInResourceGroup -resourceGroupName $resourceGroupName
        if ($azureVMResources.Count -eq 0)
        {
		    Write-TaskSpecificTelemetry "PREREQ_NoVMResources"
            throw (Get-LocalizedString -Key "No VMs found in resource group: '{0}'. Could not register environment in the output variable: '{1}'" -ArgumentList $resourceGroupName, $outputVariable)
        }

        Get-MachineConnectionInformation -resourceGroupName $resourceGroupName
    }

    $azureVMResourcesPropertiesBag = Get-AzureVMResourcesProperties -resources $azureVMResources

    $resources = @()
    foreach ($resource in $azureVMResources)
    {
        $resourceProperties = $azureVMResourcesPropertiesBag.Item($resource.Name)
        $resourceFQDN = $resourceProperties.fqdn            
        $resourceWinRMHttpsPort = $resourceProperties.winRMHttpsPort

        $machineSpec = $resourceFQDN + ":" + $resourceWinRMHttpsPort
        $resources += $machineSpec
    }

    $machineSpecification = $resources -join ","

    Write-Verbose "Starting Register-Environment cmdlet call for resource group : $resourceGroupName" -Verbose
    $environment = Register-Environment -EnvironmentName $outputVariable -EnvironmentSpecification $machineSpecification -WinRmProtocol "HTTPS" -Connection $connection -TaskContext $distributedTaskContext
    Write-Verbose "Completed Register-Environment cmdlet call for resource group : $resourceGroupName" -Verbose

    Write-Verbose "Adding environment $outputVariable to output variables" -Verbose
    Set-TaskVariable -Variable $outputVariable -Value $outputVariable
    Write-Verbose "Added the environmnent $outputVariable to output variable" -Verbose
}