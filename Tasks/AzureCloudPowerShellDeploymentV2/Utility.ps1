function Update-PSModulePathForHostedAgent {
    param()
    try {
        $hostedAgentAzModulePath = Get-LatestModule -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        $env:PSModulePath = $hostedAgentAzModulePath + ";" + $env:PSModulePath
        $env:PSModulePath = $env:PSModulePath.TrimStart(';')
    } finally {
        Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
    }
}

function Get-LatestModule {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)

    $resultFolder = ""
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
    $maxVersion = [version] "0.0.0"
    $modulePath = $env:SystemDrive + "\Modules";

    try {
        if (-not (Test-Path -Path $modulePath)) {
            return $resultFolder
        }

        $moduleFolders = Get-ChildItem -Directory -Path $modulePath | Where-Object { $regexToMatch.IsMatch($_.Name) }
        foreach ($moduleFolder in $moduleFolders) {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion) {
                $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"Az\$moduleVersion\Az.psm1")

                if(Test-Path -LiteralPath $modulePath -PathType Leaf) {
                    $maxVersion = $moduleVersion
                    $resultFolder = $moduleFolder.FullName
                } else {
                    Write-Verbose "A folder matching the module folder pattern was found at $($moduleFolder.FullName) but didn't contain a valid module file"
                }
            }
        }
    }
    catch {
        Write-Verbose "Attempting to find the Latest Module Folder failed with the error: $($_.Exception.Message)"
        $resultFolder = ""
    }
    Write-Verbose "Latest module folder detected: $resultFolder"
    return $resultFolder
}

function Get-SingleFile($files, $pattern) {
    if ($files -is [system.array]) {
        throw (Get-VstsLocString -Key "Foundmorethanonefiletodeploywithsearchpattern0Therecanbeonlyone" -ArgumentList $pattern)
    }
    if (!$files) {
        throw (Get-VstsLocString -Key "Nofileswerefoundtodeploywithsearchpattern0" -ArgumentList $pattern)
    }
    return $files
}

#Filename= DiagnosticsExtension.WebRole1.PubConfig.xml returns WebRole1
#Filename= DiagnosticsExtension.Web.Role1.PubConfig.xml returns Web.Role1
#Role names can have dots in them
function Get-RoleName($extPath) {
    $roleName = ""

    #The following statement uses the SimpleMatch option to direct the -split operator to interpret the dot (.) delimiter literally.
    #With the default, RegexMatch, the dot enclosed in quotation marks (".") is interpreted to match any character except for a newline
    #character. As a result, the Split statement returns a blank line for every character except newline.  The 0 represents the "return
    #all" value of the Max-substrings parameter. You can use options, such as SimpleMatch, only when the Max-substrings value is specified.
    $roles = $extPath -split ".",0,"simplematch"

    if ($roles -is [system.array] -and $roles.Length -gt 1) {
        $roleName = $roles[1] #base role name

        $x = 2
        while ($x -le $roles.Length) {
            if ($roles[$x] -ne "PubConfig") {
                $roleName = $roleName + "." + $roles[$x]
            }
            else {
                break
            }
            $x++
        }
    }
    else {
        Write-Warning (Get-VstsLocString -Key "_0couldnotbeparsedintopartsforregisteringdiagnosticsextensions" -ArgumentList $extPath)
    }

    return $roleName
}

function Get-AzureStoragePrimaryKey($storageAccount) {
    $storageAccountResource = Get-AzStorageAccount -Name $storageAccount
    if (!$storageAccountResource) {
        Write-Error -Message "Could not find storage account $storageAccount"
    }
    $storageAccountKeys = Get-AzStorageAccountKey -Name $storageAccount
    if (!$storageAccountKeys) {
        Write-Error -Message "Could not retrieve storage account keys from storage account resource $Storage"
    }
    $primaryStorageKey = $storageAccountKeys[0].value
    return $primaryStorageKey
}

function Get-DiagnosticsExtensions($cloudServiceName, $storageAccount, $extensionsPath, $storageAccountKeysMap) {
    $diagnosticsConfigurations = @()

    $extensionsSearchPath = Split-Path -Parent $extensionsPath
    Write-Verbose "extensionsSearchPath= $extensionsSearchPath"
    $extensionsSearchPath = Join-Path -Path $extensionsSearchPath -ChildPath "Extensions"
    Write-Verbose "extensionsSearchPath= $extensionsSearchPath"
    #$extensionsSearchPath like C:\Agent\_work\bd5f89a2\staging\Extensions
    if (!(Test-Path $extensionsSearchPath)) {
        Write-Verbose "No Azure Cloud Extensions found at '$extensionsSearchPath'"
        return $diagnosticsConfigurations
    }

    Write-Host (Get-VstsLocString -Key "Applyinganyconfigureddiagnosticsextensions")

    Write-Verbose "Getting the primary AzureStorageKey..."
    $primaryStorageKey = Get-AzureStoragePrimaryKey $StorageAccount
    if (!$primaryStorageKey) {
        Write-Warning (Get-VstsLocString -Key "Couldnotgettheprimarystoragekeyforstorageaccount" -ArgumentList "$storageAccount")
        return $diagnosticsConfigurations
    }

    Write-Verbose "##[command]Get-ChildItem -Path $extensionsSearchPath -Filter PaaSDiagnostics.*.PubConfig.xml"
    $diagnosticsExtensions = Get-ChildItem -Path $extensionsSearchPath -Filter "PaaSDiagnostics.*.PubConfig.xml"

    #$extPath like PaaSDiagnostics.WebRole1.PubConfig.xml
    foreach ($extPath in $diagnosticsExtensions) {
        $role = Get-RoleName $extPath
        if (!$role) {
            continue
        }

        $fullExtPath = Join-Path -path $extensionsSearchPath -ChildPath $extPath
        Write-Verbose "fullExtPath= $fullExtPath"

        Write-Verbose "Loading $fullExtPath as XML..."
        $publicConfig = New-Object XML
        $publicConfig.Load($fullExtPath)
        if ($publicConfig.PublicConfig.StorageAccount) {
            #We found a StorageAccount in the role's diagnostics configuration.  Use it.
            $publicConfigStorageAccountName = $publicConfig.PublicConfig.StorageAccount
            Write-Verbose "Found PublicConfig.StorageAccount= '$publicConfigStorageAccountName'"

            if ($storageAccountKeysMap.containsKey($role)) {
                Write-Verbose "##Getting diagnostics storage account name and key from passed as storage keys."

                Write-Verbose "##$storageAccountName = $publicConfigStorageAccountName"
                $storageAccountName = $publicConfigStorageAccountName
                $storageAccountKey = $storageAccountKeysMap.Get_Item($role)
            }
            else {
                try {
                    $publicConfigStorageKey = Get-AzureStoragePrimaryKey $publicConfigStorageAccountName
                }
                catch {
                    Write-Host (Get-VstsLocString -Key "Unabletofind0usingprovidedsubscription" -ArgumentList "$publicConfigStorageAccountName")
                    Write-Verbose $_.Exception.Message
                }
                if ($publicConfigStorageKey) {
                    Write-Verbose "##Getting storage account name and key from diagnostics config file"

                    Write-Verbose "##$storageAccountName = $publicConfigStorageAccountName"
                    $storageAccountName = $publicConfigStorageAccountName
                    $storageAccountKey = $publicConfigStorageKey
                }
                else {
                    Write-Warning (Get-VstsLocString -Key "Couldnotgettheprimarystoragekeyforthepublicconfigstorageaccount" -ArgumentList "$publicConfigStorageAccountName")
                    return
                }
            }
        }
        else {
            #If we don't find a StorageAccount in the XML file, use the one associated with the definition's storage account
            Write-Verbose "No StorageAccount found in PublicConfig.  Using the storage account set on the definition..."
            $storageAccountName = $storageAccount
            $storageAccountKey = $primaryStorageKey
        }

        Write-Host "New-AzCloudServiceDiagnosticsExtension -Name $role -CloudServiceName $cloudServiceName -DiagnosticsConfigurationPath $fullExtPath -StorageAccountName $storageAccountName -StorageAccountKey <storageKey> -RolesAppliedTo [$role]"
        $wadconfig = New-AzCloudServiceDiagnosticsExtension -Name $role -CloudServiceName $cloudServiceName -DiagnosticsConfigurationPath $fullExtPath `
            -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey -RolesAppliedTo @($role)

        #Add each extension configuration to the array for use by caller
        $diagnosticsConfigurations += $wadconfig
    }

    return $diagnosticsConfigurations
}

function Parse-StorageKeys($storageAccountKeys) {
    $roleStorageKeyMap = @{}
    if ($storageAccountKeys) {
        $roleKeyPairs = $storageAccountKeys.split()
        foreach($roleKeyPair in $roleKeyPairs) {
            if ($roleKeyPair) {
                $roleKeyArray = $roleKeyPair.split(":")
                if ($roleKeyArray.Length -ne 2) {
                    throw (Get-VstsLocString -Key "Storagekeysaredefinedininvalidformat" -ArgumentList $pattern)
                }
                $roleStorageKeyMap.Add($roleKeyArray[0],$roleKeyArray[1])
            }
        }
    }
    return $roleStorageKeyMap
}

function Create-AzureCloudService {
    Param (
        [Parameter(Mandatory = $true)][string] $serviceName,
        [Parameter(Mandatory = $true)][string] $resourceGroupName,
        [Parameter(Mandatory = $true)][string] $serviceLocation,
        [Parameter(Mandatory = $true)][string] $csCfg,
        [Parameter(Mandatory = $true)][string] $csDef,
        [Parameter(Mandatory = $true)][string] $csPkg,
        [Parameter(Mandatory = $true)][string] $storageAccount,
        [Parameter(Mandatory = $true)][hashtable] $tag,
        [Parameter(Mandatory = $false)][string] $keyVault,
        [Parameter(Mandatory = $false)][array] $diagnosticExtensions,
        [Parameter(Mandatory = $false)][string] $upgradeMode
    )

    # to compensation the issue with inability to pass -Force parameter to underlying comamnds in New-AzCloudService command
    Cleanup-Resources-For-Recreation -serviceName $serviceName -resourceGroupName $resourceGroupName -storageAccount $storageAccount

    if (!$upgradeMode) {
        $upgradeMode = 'Auto'
    }
    $azureService = "New-AzCloudService -Name `"$serviceName`" -ResourceGroupName `"$resourceGroupName`" -Location `"$serviceLocation`" -ConfigurationFile `"$csCfg`""
    $azureService += " -DefinitionFile `"$csDef`" -PackageFile `"$csPkg`" -StorageAccount `"$storageAccount`" -Tag `"$($tag | ConvertTo-Json -Compress)`" -UpgradeMode `"$upgradeMode`"";
    if ($KeyVault) {
        $azureService += " -KeyVaultName `"$KeyVault`""
        if ($diagnosticExtensions -and ($diagnosticExtensions.Length -gt 0)) {
            $azureService += " -ExtensionProfile @($(diagnosticExtensions.Length) extensions)"
            Write-Host "$azureService"
            $extensionProfile = @{extension = @($diagnosticExtensions)}
            New-AzCloudService -Name "$ServiceName" -ResourceGroupName "$resourceGroupName" -Location "$serviceLocation" -ConfigurationFile "$csCfg" `
                -DefinitionFile "$csDef" -PackageFile "$csPkg" -StorageAccount "$storageAccount" -Tag $tag -UpgradeMode "$upgradeMode" -KeyVaultName "$KeyVault" -ExtensionProfile $extensionProfile
        }
        else {
            Write-Host "$azureService"
            New-AzCloudService -Name "$serviceName" -ResourceGroupName "$resourceGroupName" -Location "$serviceLocation" -ConfigurationFile "$csCfg" `
                -DefinitionFile "$csDef" -PackageFile "$csPkg" -StorageAccount "$storageAccount" -Tag $tag -UpgradeMode "$upgradeMode" -KeyVaultName "$KeyVault"
        }
    }
    else {
        if ($diagnosticExtensions -and ($diagnosticExtensions.Length -gt 0)) {
            $azureService += " -ExtensionProfile @($(diagnosticExtensions.Length) extensions)"
            Write-Host "$azureService"
            $extensionProfile = @{extension = @($diagnosticExtensions)}
            New-AzCloudService -Name "$serviceName" -ResourceGroupName "$resourceGroupName" -Location "$serviceLocation" -ConfigurationFile "$csCfg" `
                -DefinitionFile "$csDef" -PackageFile "$csPkg" -StorageAccount "$storageAccount" -Tag $tag -UpgradeMode "$upgradeMode" -ExtensionProfile $extensionProfile
        }
        else {
            Write-Host "$azureService"
            New-AzCloudService -Name "$serviceName" -ResourceGroupName "$resourceGroupName" -Location "$serviceLocation" -ConfigurationFile "$csCfg" `
                -DefinitionFile "$csDef" -PackageFile "$csPkg" -StorageAccount "$storageAccount" -Tag $tag -UpgradeMode "$upgradeMode"
        }
    }
}

function Cleanup-Resources-For-Recreation {
    Param (
        [Parameter(Mandatory = $true)][string] $serviceName,
        [Parameter(Mandatory = $true)][string] $resourceGroupName,
        [Parameter(Mandatory = $true)][string] $storageAccount
    )

    $storageContext = New-AzStorageContext -StorageAccountName $storageAccount -UseConnectedAccount
    try {
        Remove-AzStorageBlob -Container "cloudservicecontainer" -Blob $($ServiceName + ".cspkg") -Context $storageContext -Force
    }
    catch {
        # It doesn't exist, no need to clean up
    }
    try {
        Remove-AzPublicIpAddress -Name ($serviceName + "Ip") -ResourceGroupName $resourceGroupName -Force
    }
    catch {
        # It doesn't exist, no need to clean up
    }
}

function Validate-AzureCloudServiceStatus {
    Param (
        [Parameter(Mandatory = $true)][string] $cloudServiceName,
        [Parameter(Mandatory = $true)][string] $resourceGroupName
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $retryDelay = 30
        Write-Host (Get-VstsLocString -Key 'ValidateAzureCloudServiceStatus' -ArgumentList $cloudServiceName)
        while ($true) {
            $azureService = Get-AzCloudService -Name $cloudServiceName -ResourceGroupName $resourceGroupName
            if ($azureService) {
                Write-Verbose "Azure Cloud Service with name:'$cloudServiceName' exists."
                if ($azureService.ProvisioningState -ne 'Succeeded') {
                    Write-Verbose "Azure Cloud Service: '$cloudServiceName' (State: $($azureService.ProvisioningState)) is not in 'Succeeded' State"
                }
                elseif (Assert-RoleInstancesAreReady $cloudServiceName $resourceGroupName) {
                    Write-Host (Get-VstsLocString -Key 'AzureCloudServiceIsReady' -ArgumentList $cloudServiceName)
                    return
                }
            }
            else {
                Write-Warning (Get-VstsLocString -Key 'AzureCloudServiceNotFound' -ArgumentList $cloudServiceName)
            }

            Write-Host (Get-VstsLocString -Key "RetryAzureCloudServiceStatusCheck" -ArgumentList $cloudServiceName, $retryDelay)
            Start-Sleep -Seconds $retryDelay
        }
        Write-Warning (Get-VstsLocString -Key 'AzureCloudServiceIsNotReady' -ArgumentList $cloudServiceName)
    }
    catch {
        Write-Verbose "An error occurred while validating Azure Cloud Service: '$cloudServiceName' status. Error: $($_.Exception.ToString())"
    }
    finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Assert-RoleInstancesAreReady {
    Param (
        [Parameter(Mandatory = $true)][string] $cloudServiceName,
        [Parameter(Mandatory = $true)][string] $resourceGroupName
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation
    try {
        $roleInstaces = Get-AzCloudServiceRoleInstance -CloudServiceName $cloudServiceName -ResourceGroupName $resourceGroupName
        if ($roleInstaces.Length -eq 0) {
            Write-Verbose "Azure Cloud Service: '$cloudServiceName' has no role instances."
            return $false
        }
        $staredInstancesCount = 0
        foreach ($roleInstance in $roleInstaces) {
            $riv = Get-AzCloudServiceRoleInstanceView -CloudServiceName $cloudServiceName -ResourceGroupName $resourceGroupName -RoleInstanceName $roleInstance.Name
            if ($riv) {
                if ($riv.Statuses[0].DisplayStatus -eq 'RoleStateStarted') {
                    $staredInstancesCount += 1
                }
                Write-Verbose "InstanceName: $($roleInstance.Name), InstanceStatus: $($riv.Statuses[0].DisplayStatus)"
            }
            else {
                Write-Warning "Couldn't get role instance view for role instance name: $($roleInstance.Name)"
            }
        }
        if ($staredInstancesCount -lt $roleInstances.Length) {
            Write-Verbose "Only $staredInstancesCount role instances are started out of $($roleInstances.Length)."
            return $false
        }
        else {
            Write-Host (Get-VstsLocString -Key 'AllRoleInstancesAreReady' -ArgumentList $cloudServiceName, $staredInstancesCount)
            return $true
        }
    }
    catch {
        Write-Verbose "An error occurred while trying to check all role instances are ready. Error: $($_.Exception.ToString())"
        return $false
    }
    finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
