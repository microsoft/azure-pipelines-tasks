function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw "Found more than one file to deploy with search pattern $pattern. There can be only one."
    }
    else
    {
        if (!$files)
        {
            throw "No files were found to deploy with search pattern $pattern"
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
        Throw "Please specify a complete and a valid template file path"
    }

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and !(Test-Path -Path $csmParametersFile -PathType Leaf))
    {
         Throw "Please specify a complete and a valid template parameters file path"
    }
}

function Get-CsmParameterObject
{
    param([string]$csmParameterFileContent,
          [string]$overrideParameters)

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

        if ([string]::IsNullOrEmpty($overrideParameters) -eq $false)
        {
            $paramsList = New-Object System.Collections.Generic.List[string]

            $paramsList = $overrideParameters.Split("-") | Where-Object {$_.Length -gt 0}

            for($i = 0; $i -lt $paramsList.Count; $i = $i+1)
            {
                $space = $paramsList[$i].IndexOf(' ')
                if($space -eq -1)
                {
                    Throw "Specified argument list is not in the correct format"
                }
            
                $parameterName = $paramsList[$i].Substring(0, $space)
                $parameterValue = $paramsList[$i].Substring($space + 1).TrimEnd(' ')
                Write-Verbose "Overwrote the parameter $parameterName from the input with the vale $parameterValue" -Verbose
                $newParametersObject[$parameterName] = $parameterValue
            }
        }

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
            Throw "Please specify valid username"
        }

        if([string]::IsNullOrEmpty($vmPassword) -eq $true)
        {
            Throw "Please specify valid password"
        }
    }

}

function Validate-AzureKeyVaultSecret
{
    param([string]$certificatePath,
          [string]$certificatePassword)

    if (([string]::IsNullOrEmpty($certificatePassword) -eq $true) -or (-Not (Test-Path $certificatePath -pathType leaf)))
    {
        Throw "Please specify valid certificate path"
    }

    if([string]::IsNullOrEmpty($certificatePassword) -eq $true)
    {
        Throw "Please specify valid certificate password"
    }
}

function Create-CSMForWinRMConfiguration
{
    param([string]$baseCsmFileContent,
          [string]$protocol,
          [string]$resourceGroupName,
          [string]$azureKeyVaultName,
          [string]$azureKeyVaultSecretId)

    Write-Verbose -Verbose "Generating deplyoment template for WinRM configuration from base template file"
    Write-Verbose -Verbose "Network Protocol : $protocol"
    Write-Verbose -Verbose "azureKeyVaultSecretId : $azureKeyVaultSecretId"
    . ./Constants.ps1

    $csmJTokenObject = [Newtonsoft.Json.Linq.JToken]::Parse($baseCsmFileContent)
    $virtualMachineResources = $csmJTokenObject.SelectToken("resources") | Where-Object { $_["type"].Value -eq "Microsoft.Compute/virtualMachines" }

    if($virtualMachineResources -eq $null)
    {
        Throw "No virtual Machine Resource found in the deploymnet template"
    }

    # TODO: Explore to avoid if/else statement, didn't find better way to check if virtualMachineResources is returning as array or single item
    if ($virtualMachineResources -is [system.array])
    {
        Write-Verbose -Verbose "Found $($virtualMachineResources.Count) Virtual Machine resources in the deployment template"

        Foreach($virtualMachineResource in $virtualMachineResources)
        {
            Add-NodesForWinRmConfiguration -jtokenObject $virtualMachineResource -resourceGroupName $resourceGroupName -protocol $protocol -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecretId
        }
    }
    else
    {
        Write-Verbose -Verbose "Found single Virtual Machine resource in the deployment template"

        Add-NodesForWinRmConfiguration -jtokenObject $virtualMachineResources -resourceGroupName $resourceGroupName -protocol $protocol -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecretId
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
          [string]$protocol,
          [string]$azureKeyVaultName,
          [string]$azureKeyVaultSecretId)

    $osProfile = $jtokenObject.SelectToken("properties.osProfile")
    if($osProfile -eq $null)
    {
        Throw "No 'osProfile' found in Virtual Machine Resource, can't add WinRm Configuration Node'"
    }

    Add-SecretsNode -jtokenObject $jtokenObject -resourceGroupName $resourceGroupName -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecretId
    Add-WindowsConfigurationNode -jtokenObject $jtokenObject -protocol $protocol -azureKeyVaultSecretId $azureKeyVaultSecretId

    Write-Verbose -Verbose "Update OSProfile Node $osProfile"
}

function Add-SecretsNode
{
    param([Newtonsoft.Json.Linq.JObject]$jtokenObject,
          [string]$resourceGroupName,
          [string]$azureKeyVaultName,
          [string]$azureKeyVaultSecretId)

    if($jtokenObject.SelectToken("secrets") -eq $null)
    {
        Write-Verbose -Verbose "No 'secrets' node found in virtual machine resource"
        $jArrayObject = New-Object 'Newtonsoft.Json.Linq.JArray'
        $jtokenObject.properties.osProfile.Add("secrets", $jArrayObject)
    }

    $secretsJObject = [Newtonsoft.Json.Linq.JToken]::Parse($secrets)
    $jtokenObject.properties.osProfile.secrets.Add($secretsJObject)
    Write-Verbose -Verbose "Added 'secrets' node for WinRM configuration"
}

function Add-WindowsConfigurationNode
{
    param([Newtonsoft.Json.Linq.JObject]$jtokenObject,
          [string]$protocol,
          [string]$azureKeyVaultSecretId)

    if($jtokenObject.SelectToken("windowsConfiguration") -eq $null)
    {
        Write-Verbose -Verbose "No 'windowsConfiguration' node found in virtual machine resource"
        $jObject = New-Object 'Newtonsoft.Json.Linq.JObject'
        $jtokenObject.properties.osProfile.Add("windowsConfiguration", $jObject)
    }

    $jtokenObject.properties.osProfile.windowsConfiguration["provisionVMAgent"] = '"true"'
    $jtokenObject.properties.osProfile.windowsConfiguration["enableAutomaticUpdates"] = '"true"'

    Switch ($protocol)
    {
         "WinRM HTTP" {
             $protocolJObject=[Newtonsoft.Json.Linq.JToken]::Parse($winrmHttpListner)
         }

         "WinRM HTTPS" {
             $protocolJObject=[Newtonsoft.Json.Linq.JToken]::Parse($winrmHttpsListner)
         }

         "Both" {
             $protocolJObject=[Newtonsoft.Json.Linq.JToken]::Parse($winrmBothListners)
         }
 
         default {
              Write-Error("Invalid Protocol: $protocol.")
         }
    }

    $jtokenObject.properties.osProfile.windowsConfiguration["winRM"] = $protocolJObject
    Write-Verbose -Verbose "Added 'windowsConfiguration' node for WinRM configuration"
}

function Get-RandomString
{
    return [guid]::NewGuid().ToString("N").Substring(0,20)
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