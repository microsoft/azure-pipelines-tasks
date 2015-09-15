function Validate-AzurePowershellVersion
{
    $currentVersion =  Get-AzureCmdletsVersion
    $minimumAzureVersion = New-Object System.Version(0, 9, 0)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    if(!$versionCompatible)
    {
        Throw (Get-LocalizedString -Key "The required minimum version {0} of the Azure Powershell Cmdlets are not installed. You can follow the instructions at http://azure.microsoft.com/en-in/documentation/articles/powershell-install-configure/ to get the latest Azure powershell" -ArgumentList $minimumAzureVersion)
    }

    Write-Verbose -Verbose "Validated the required azure powershell version"
}

function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw (Get-LocalizedString -Key "Found more than one file to deploy with search pattern '{0}'. There can be only one" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
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
        throw (Get-LocalizedString -Key "Please specify a complete and a valid template file path")
    }

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and !(Test-Path -Path $csmParametersFile -PathType Leaf))
    {
         throw (Get-LocalizedString -Key "Please specify a complete and a valid template parameters file path")
    }
}

function Get-CsmParameterObject
{
    param([string]$csmParameterFileContent)

    if ([string]::IsNullOrEmpty($csmParameterFileContent) -eq $false)
    {
        Write-Verbose "Generating csm parameter object" -Verbose

        $csmJObject = [Newtonsoft.Json.Linq.JObject]::Parse($csmParameterFileContent)
        $newParametersObject = New-Object System.Collections.Hashtable([System.StringComparer]::InvariantCultureIgnoreCase)
        
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

        return $newParametersObject
    }
}

function Validate-Credentials
{
    param([string]$vmCreds,
          [string]$vmUserName,
          [string]$vmPassword)

    if ($vmCreds -eq "true")
    {
        if([string]::IsNullOrEmpty($vmUserName) -eq $true)
        {
            throw (Get-LocalizedString -Key "Please specify valid username")
        }

        if([string]::IsNullOrEmpty($vmPassword) -eq $true)
        {
            throw (Get-LocalizedString -Key "Please specify valid password")
        }
    }
}

function Validate-AzureKeyVaultSecret
{
    param([string]$certificatePath,
          [string]$certificatePassword)

    if (([string]::IsNullOrEmpty($certificatePath) -eq $true) -or (-Not (Test-Path $certificatePath -pathType leaf)))
    {
        throw (Get-LocalizedString -Key "Please specify valid certificate path")
    }

    if([string]::IsNullOrEmpty($certificatePassword) -eq $true)
    {
        throw (Get-LocalizedString -Key "Please specify valid certificate password")
    }

    if([System.IO.Path]::GetExtension($certificatePath) -ne ".pfx")
    {
        throw (Get-LocalizedString -Key "Please specify pfx certificate file")
    }
}

function Upload-CertificateOnAzureKeyVaultAsSecret
{
    param([string]$certificatePath,
    [string]$certificatePassword,
    [string]$resourceGroupName,
    [string]$location,
    [string]$azureKeyVaultName,
    [string]$azureKeyVaultSecretName)

    #Find the matching certificate File
    $certificatePath = Get-File $certificatePath
    Write-Verbose -Verbose "CertificatePath = $certificatePath"

    Validate-AzureKeyVaultSecret -certificatePath $certificatePath -certificatePassword $certificatePassword

    Create-AzureResourceGroupIfNotExist -resourceGroupName $resourceGroupName -location $location

    Create-AzureKeyVaultIfNotExist -azureKeyVaultName $azureKeyVaultName -ResourceGroupName $resourceGroupName -Location $location

    $secretValue = Get-SecretValueForAzureKeyVault -certificatePath $certificatePath -certificatePassword $certificatePassword

    $azureKeyVaultSecret = Create-AzureKeyVaultSecret -azureKeyVaultName $azureKeyVaultName -secretName $azureKeyVaultSecretName -secretValue $secretValue

    $azureKeyVaultSecretId = $azureKeyVaultSecret.Id

    return $azureKeyVaultSecretId
}

function Create-CSMForWinRMConfiguration
{
    param([string]$baseCsmFileContent,
          [string]$winrmListeners,
          [string]$resourceGroupName,
          [string]$azureKeyVaultName,
          [string]$azureKeyVaultSecretId)

    $csmJTokenObject = [Newtonsoft.Json.Linq.JToken]::Parse($baseCsmFileContent)
    $virtualMachineResources = $csmJTokenObject.SelectToken("resources") | Where-Object { $_["type"].Value -eq "Microsoft.Compute/virtualMachines" }
    if($virtualMachineResources -eq $null)
    {
        Write-Warning (Get-LocalizedString -Key "No virtual Machine Resource found in the deployment template, can't add WinRm Configuration Node")
        return
    }

    Write-Verbose -Verbose "Generating deployment template for WinRM configuration from base template file"
    Write-Verbose -Verbose "azureKeyVaultName : $azureKeyVaultName"
    Write-Verbose -Verbose "azureKeyVaultSecretId : $azureKeyVaultSecretId"

    # TODO: Explore to avoid if/else statement, didn't find better way to check if virtualMachineResources is returning as array or single item
    if ($virtualMachineResources -is [system.array])
    {
        Write-Verbose -Verbose "Found $($virtualMachineResources.Count) Virtual Machine resources in the deployment template"

        Foreach($virtualMachineResource in $virtualMachineResources)
        {
            Add-NodesForWinRmConfiguration -jtokenObject $virtualMachineResource -resourceGroupName $resourceGroupName -winrmListeners $winrmListeners -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecretId
        }
    }
    else
    {
        Write-Verbose -Verbose "Found single Virtual Machine resource in the deployment template"

        Add-NodesForWinRmConfiguration -jtokenObject $virtualMachineResources -resourceGroupName $resourceGroupName -winrmListeners $winrmListeners -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecretId
    }

    $tempFile = [System.IO.Path]::GetTempFileName()
    Write-Verbose -Verbose "Created temp file $tempFile for template with WinRM configuration support"
    $csmJTokenObject.ToString() > $tempFile

    return $tempFile;
}

function Add-NodesForWinRmConfiguration
{
    param([Newtonsoft.Json.Linq.JObject]$jtokenObject,
          [string]$resourceGroupName,
          [string]$winrmListeners,
          [string]$azureKeyVaultName,
          [string]$azureKeyVaultSecretId)

    $osProfile = $jtokenObject.SelectToken("properties.osProfile")
    if($osProfile -eq $null)
    {
        Write-Warning (Get-LocalizedString -Key "No 'osProfile' found in Virtual Machine Resource, can't add WinRm Configuration Node'")
        return
    }

    if($winrmListeners -eq "winrmhttps")
    {
        Add-SecretsNode -jtokenObject $jtokenObject -resourceGroupName $resourceGroupName -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecretId
    }

    Add-WindowsConfigurationNode -jtokenObject $jtokenObject -winrmListeners $winrmListeners -azureKeyVaultSecretId $azureKeyVaultSecretId

    Write-Verbose -Verbose "Update OSProfile Node $osProfile"
}

function Add-SecretsNode
{
    param([Newtonsoft.Json.Linq.JObject]$jtokenObject,
          [string]$resourceGroupName,
          [string]$azureKeyVaultName,
          [string]$azureKeyVaultSecretId)

    if($jtokenObject.SelectToken("properties.osProfile.secrets") -eq $null)
    {
        Write-Verbose -Verbose "No 'secrets' node found in virtual machine resource"
        $jArrayObject = New-Object 'Newtonsoft.Json.Linq.JArray'
        $jtokenObject.properties.osProfile.Add("secrets", $jArrayObject)
    }

    $secretsJson = "{
                ""sourceVault"": {
                    ""id"": ""[resourceId('$resourceGroupName', 'Microsoft.KeyVault/vaults', '$azureKeyVaultName')]""
                  },
                  ""vaultCertificates"": [
                    {
                      ""certificateUrl"": ""$azureKeyVaultSecretId"",
                      ""certificateStore"": ""My""
                    }
                  ]
           }"

    $secretsJObject = [Newtonsoft.Json.Linq.JToken]::Parse($secretsJson)
    $jtokenObject.properties.osProfile.secrets.Add($secretsJObject)
    Write-Verbose -Verbose "Added 'secrets' node for WinRM configuration"
}

function Add-WindowsConfigurationNode
{
    param([Newtonsoft.Json.Linq.JObject]$jtokenObject,
          [string]$winrmListeners,
          [string]$azureKeyVaultSecretId)

    if($jtokenObject.SelectToken("properties.osProfile.windowsConfiguration") -eq $null)
    {
        Write-Verbose -Verbose "No 'windowsConfiguration' node found in virtual machine resource"
        $jObject = New-Object 'Newtonsoft.Json.Linq.JObject'
        $jtokenObject.properties.osProfile.Add("windowsConfiguration", $jObject)
    }

    $jtokenObject.properties.osProfile.windowsConfiguration["provisionVMAgent"] = '"true"'
    $jtokenObject.properties.osProfile.windowsConfiguration["enableAutomaticUpdates"] = '"true"'
    if($jtokenObject.SelectToken("properties.osProfile.windowsConfiguration.winRM") -eq $null)
    {
        Write-Verbose -Verbose "No 'winRM' node found under windowsConfiguration node"
        $jWinRmObject = New-Object 'Newtonsoft.Json.Linq.JObject'
        $jtokenObject.properties.osProfile.windowsConfiguration.Add("winRM", $jWinRmObject)
    }

    $winrmHttpListenerJson = "{
                              ""protocol"": ""http""
                              }"

    $winrmHttpsListenerJson = "{
                              ""protocol"": ""https"",
                              ""certificateUrl"": ""$azureKeyVaultSecretId""
                               }"

    Switch ($winrmListeners)
    {
         "winrmhttp" {
             $winrmListenersJObject=[Newtonsoft.Json.Linq.JToken]::Parse($winrmHttpListenerJson)
         }

         "winrmhttps" {
             $winrmListenersJObject=[Newtonsoft.Json.Linq.JToken]::Parse($winrmHttpsListenerJson)
         }

         default {
              Write-Error (Get-LocalizedString -Key "Invalid WinRM Listeners: {0}." -ArgumentList $winrmListeners)
         }
    }

    if($jtokenObject.SelectToken("properties.osProfile.windowsConfiguration.winRM.Listeners") -eq $null)
    {
        Write-Verbose -Verbose "No WinRM Listeners node found under windowsConfiguration node"
        $jArrayObject = New-Object 'Newtonsoft.Json.Linq.JArray'
        $jtokenObject.properties.osProfile.windowsConfiguration.winRM.Add("Listeners", $jArrayObject)
    }

    $jtokenObject.properties.osProfile.windowsConfiguration.winRM.Listeners.Add($winrmListenersJObject)
    Write-Verbose -Verbose "Added 'windowsConfiguration' node for WinRM configuration"
}

function Get-RandomString
{
    return [guid]::NewGuid().ToString("N").Substring(0,17)
}

function Get-SecretValueForAzureKeyVault
{
    param([string]$certificatePath,
          [string]$certificatePassword)

    $fileContentBytes = Get-Content $certificatePath -Encoding Byte
    $fileContentEncoded = [System.Convert]::ToBase64String($fileContentBytes)

    $jsonObject = "
    {
    ""data"": ""$filecontentencoded"",
    ""dataType"" :""pfx"",
    ""password"": ""$certificatePassword""
    }"

    $jsonObjectBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonObject)
    $jsonEncoded = [System.Convert]::ToBase64String($jsonObjectBytes)

    $secret = ConvertTo-SecureString -String $jsonEncoded -AsPlainText –Force

    return $secret
}

function Invoke-OperationHelper
{
     param([string]$machineGroupName,
           [string]$operationName,
           [Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2[]]$machines)

    Write-Verbose "Entered perform action $operationName on machines for machine group $machineGroupName" -Verbose

    if(! $machines)
    {
        Write-Verbose "Machine group $machineGroupName has no machines in it" -Verbose
        return
    }

    $machineStatus = "Succeeded"

    # Logs in the Dtl service that operation has started.
    $operationId = Invoke-MachineGroupOperation -machineGroupName $machineGroupName -operationName $operationName -machines $machines

    if($machines.Count -gt 0)
    {
       $passedOperationCount = $machines.Count
    }

    Foreach($machine in $machines)
    {
        $machineName = $machine.Name
        $error = Invoke-OperationOnProvider -machineGroupName $machineGroupName -machineName $machine.Name -operationName $operationName
        Write-Verbose "[Azure Resource Manager]Call to provider to perform operation '$operationName' on the machine '$machineName' completed" -Verbose        

        $errorMessage = [string]::Empty
        # Determines the status of the operation. Marks the status of machine group operation as 'Failed' if any one of the machine operation fails.
        if($error.Count -ne 0)
        {
            $machineStatus = $status = "Failed"
            $passedOperationCount--
            
            if($error[0].Exception)
            {
                $errorMessage = $error[0].Exception.Message
            }

            Write-Warning(Get-LocalizedString -Key "Operation '{0}' on machine '{1}' failed with error '{2}'" -ArgumentList $operationName, $machine.Name, $errorMessage)
        }
        else
        {
            $status = "Succeeded"
            Write-Verbose "'$operationName' operation on the machine '$machineName' succeeded" -Verbose
        }

        # Logs the completion of particular machine operation. Updates the status based on the provider response.
        End-MachineOperation -machineGroupName $machineGroupName -machineName $machine.Name -operationName $operationName -operationId $operationId -status $status -error $errorMessage
    }

    # Logs completion of the machine group operation.
    End-MachineGroupOperation -machineGroupName $machineGroupName -operationName operationName -operationId $operationId -status $machineStatus
    Throw-ExceptionIfOperationFailesOnAllMachine -passedOperationCount $passedOperationCount -operationName $operationName -machineGroupName $machineGroupName
}

function Delete-MachineGroupHelper
{
    param([string]$machineGroupName)

    Write-Verbose "Entered delete machine group helper for machine group $machineGroupName" -Verbose

    Delete-MachineGroupFromProvider -machineGroupName $MachineGroupName

    # Deletes the machine or machine group from Dtl
    Delete-MachineGroup -machineGroupName $MachineGroupName 
}

function Delete-MachinesHelper
{
    param([string]$machineGroupName,
          [string]$filters,
          [Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2[]]$machines)

    Write-Verbose "Entered delete machines for the machine group $machineGroupName" -Verbose

    
    # If there are no machines corresponding to given machine names or tags then will not delete any machine.
    if(! $machines -or $machines.Count -eq 0)
    {
        return
    }

    $passedOperationCount = $machines.Count
    Foreach($machine in $machines)
    {
        $response = Delete-MachineFromProvider -machineGroupName $machineGroupName -machineName $machine.Name 
        if($response -ne "Succeeded")
        {
            $passedOperationCount--
        }
        else
        {
            $filter = $filter + $machine.Name + ","
        }
    }

    Throw-ExceptionIfOperationFailesOnAllMachine -passedOperationCount $passedOperationCount -operationName $operationName -machineGroupName $machineGroupName

    # Deletes the machine or machine group from Dtl
    Delete-MachineGroup -machineGroupName $MachineGroupName -filters $filter
}

function Invoke-OperationOnProvider
{
    param([string]$machineGroupName,
          [string]$machineName,
          [string]$operationName)

    # Performes the operation on provider based on the operation name.
    Switch ($operationName)
    {
         "Start" {
             $error = Start-MachineInProvider -machineGroupName $machineGroupName -machineName $machineName                          
         }

         "Stop" {
             $error = Stop-MachineInProvider -machineGroupName $machineGroupName -machineName $machineName
         }

         "Restart" {
             $error = Restart-MachineInProvider -machineGroupName $machineGroupName -machineName $machineName
         }

         default {
              throw (Get-LocalizedString -Key "Tried to invoke an invalid operation: '{0}'" -ArgumentList $operationName)
         }
    }
    return $error
}

# Task fails if operation fails on all the machines
function Throw-ExceptionIfOperationFailesOnAllMachine
{
   param([string]$passedOperationCount,
         [string]$operationName,
         [string]$machineGroupName)

  if(($passedOperationCount -ne $null) -and ($passedOperationCount -eq 0))
  {
        throw ( Get-LocalizedString -Key "Operation '{0}' failed on the machines in '{1}'" -ArgumentList $operationName, $machineGroupName )
  }
}

# Gets the tags in correct format
function Get-WellFormedTagsList
{
    [CmdletBinding()]
    Param
    (
        [string]$tagsListString
    )

    if([string]::IsNullOrWhiteSpace($tagsListString))
    {
        return $null
    }

    $tagsArray = $tagsListString.Split(';')
    $tagList = New-Object 'System.Collections.Generic.List[Tuple[string,string]]'
    foreach($tag in $tagsArray)
    {
        if([string]::IsNullOrWhiteSpace($tag)) {continue}
        $tagKeyValue = $tag.Split(':')
        if($tagKeyValue.Length -ne 2)
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        if([string]::IsNullOrWhiteSpace($tagKeyValue[0]) -or [string]::IsNullOrWhiteSpace($tagKeyValue[1]))
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        $tagTuple = New-Object "System.Tuple[string,string]" ($tagKeyValue[0].Trim(), $tagKeyValue[1].Trim())
        $tagList.Add($tagTuple) | Out-Null
    }

    $tagList = [System.Collections.Generic.IEnumerable[Tuple[string,string]]]$tagList
    return ,$tagList
}

function Update-EnvironmentDetailsInDTL
{
    param([Object]$subscription,
          [string]$csmFileName,
          [string]$resourceGroupName,
          [string]$environmentStatus)

    Write-Verbose ("Updating Machine group $resourceGroupName details in DTL")

    $provider = Create-Provider -providerName "AzureResourceGroupManagerV2" -providerType "Microsoft Azure Compute Resource Provider"

    $providerData = Create-ProviderData -providerName $provider.Name -providerDataName $subscription.SubscriptionName -providerDataType $subscription.Environment -subscriptionId $subscription.SubscriptionId

    $environmentDefinitionName = [System.String]::Format("{0}_{1}", $csmFileName, $env:BUILD_BUILDNUMBER)

    $environmentDefinition = Create-EnvironmentDefinition -environmentDefinitionName $environmentDefinitionName -providerName $provider.Name

    $providerDataNames = New-Object System.Collections.Generic.List[string]
    $providerDataNames.Add($providerData.Name)

    $environmentResources = Get-Resources -resourceGroupName $resourceGroupName

    $environment = Create-Environment -environmentName $resourceGroupName -environmentType "Azure CSM V2" -environmentStatus $environmentStatus -providerName $provider.Name -providerDataNames $providerDataNames -environmentDefinitionName $environmentDefinition.Name -resources $environmentResources

    $environmentOperationId = Create-EnvironmentOperation -environment $environment
}

function Get-CsmAndParameterFiles
{
    param([string] $csmFile,
          [string] $csmParametersFile)

    #Find the matching deployment definition File
    $csmFile = Get-File $csmFile
    Write-Verbose -Verbose "deploymentDefinitionFile = $csmFile"

    # csmParametersFile value would be  BUILD_SOURCESDIRECTORY when left empty in UI.
    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY)
    {
        #Find the matching deployment definition Parameter File
        $csmParametersFile = Get-File $csmParametersFile
        Write-Verbose -Verbose "deploymentDefinitionParametersFile = $csmParametersFile"
    }

    Validate-DeploymentFileAndParameters -csmFile $csmFile -csmParametersFile $csmParametersFile

    @{"csmFile" = $($csmFile); "csmParametersFile" = $($csmParametersFile)}
}

function Get-FilterDetails
{
    param([string]$action,
        [string]$resourceFilteringMethodStart,
        [string]$filtersStart,
        [string]$resourceFilteringMethodStop,
        [string]$filtersStop,
        [string]$resourceFilteringMethodRestart,
        [string]$filtersRestart,
        [string]$resourceFilteringMethodDelete,
        [string]$filtersDelete,
        [string]$resourceFilteringMethodDeleteRG,
        [string]$filtersDeleteRG)
    $resourceFilteringMethod = ""
    $filters= ""

    Switch ($action)
    {
         "Start" {
             $resourceFilteringMethod = $resourceFilteringMethodStart
             $filters = $filtersStart
             break
          }

          "Stop" {
             $resourceFilteringMethod = $resourceFilteringMethodStop
             $filters = $filtersStop
             break
          }

          "Restart" {
             $resourceFilteringMethod = $resourceFilteringMethodRestart
             $filters = $filtersRestart
             break
          }

          "Delete" {
             $resourceFilteringMethod = $resourceFilteringMethodDelete
             $filters = $filtersDelete
             break
          }

         default { }
    }

     Write-Verbose "Resource filtering method: $resourceFilteringMethod" -Verbose
     Write-Verbose "Resource filters: $filters" -Verbose

    @{"resourceFilteringMethod" = $($resourceFilteringMethod); "filters" = $($filters) }
}

function Get-ProviderHelperFile
{
    param([Object]$machineGroup)

    # If providerName is null or empty then follow same path as standard environment.
    if($machineGroup.Provider -eq $null)
    {
        $providerName = "Pre-existing machines"
    }
    else
    {
        $providerName = $machineGroup.Provider.Name
    }

    Write-Verbose -Verbose "ProviderName = $providerName"

    $providerName
}

function Perform-Action
{
    param([string]$action,
          [string]$resourceGroupName,
          [Object]$resources,
          [string]$filters,
          [string]$providerName)

    Switch ($Action)
    {
          { @("Start", "Stop", "Restart") -contains $_ } {
             Invoke-OperationHelper -machineGroupName $resourceGroupName -operationName $action -machines $machineGroup.Resources
             break
          }

          "Delete" {
             Delete-MachinesHelper -machineGroupName $resourceGroupName -filters $filters -machines $machineGroup.Resources
             break
          }

          "DeleteRG" {            
             Delete-MachineGroupHelper -machineGroupName $resourceGroupName             
             break
          }

         default { throw (Get-LocalizedString -Key "Action '{0}' is not supported on the provider '{1}'" -ArgumentList $action, $providerName) }
    }
}