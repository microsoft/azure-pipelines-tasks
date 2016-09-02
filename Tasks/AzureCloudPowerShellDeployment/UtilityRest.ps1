Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_

function Get-DiagnosticsExtensions($storageAccount, $extensionsPath, $connectedServiceName)
{
    $endpoint =  Get-VstsEndpoint -Name "$connectedServiceName"
    $diagnosticsConfigurations = @()
    
    $extensionsSearchPath = Split-Path -Parent $extensionsPath
    Write-Verbose "extensionsSearchPath= $extensionsSearchPath"
    $extensionsSearchPath = Join-Path -Path $extensionsSearchPath -ChildPath "Extensions"
    Write-Verbose "extensionsSearchPath= $extensionsSearchPath"
    #$extensionsSearchPath like C:\Agent\_work\bd5f89a2\staging\Extensions
    if (!(Test-Path $extensionsSearchPath))
    {
        Write-Verbose "No Azure Cloud Extensions found at '$extensionsSearchPath'"
    }
    else
    {
        Write-Host (Get-VstsLocString -Key "Applyinganyconfigureddiagnosticsextensions")

        Write-Verbose "Getting the primary AzureStorageKey..."
        $primaryStorageKey = (Get-AzStorageKey -StorageAccountName "$storageAccount" -endpoint $endpoint).Primary

        if ($primaryStorageKey)
        {
            Write-Verbose "##[command]New-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey <key>"
            $definitionStorageContext = New-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $primaryStorageKey

            Write-Verbose "##[command]Get-ChildItem -Path $extensionsSearchPath -Filter PaaSDiagnostics.*.PubConfig.xml"
            $diagnosticsExtensions = Get-ChildItem -Path $extensionsSearchPath -Filter "PaaSDiagnostics.*.PubConfig.xml"

            #$extPath like PaaSDiagnostics.WebRole1.PubConfig.xml
            foreach ($extPath in $diagnosticsExtensions)
            {
                $role = Get-RoleName $extPath
                if ($role)
                {
                    $fullExtPath = Join-Path -path $extensionsSearchPath -ChildPath $extPath
                    Write-Verbose "fullExtPath= $fullExtPath"

                    Write-Verbose "Loading $fullExtPath as XML..."
                    $publicConfig = New-Object XML
                    $publicConfig.Load($fullExtPath)
                    if ($publicConfig.PublicConfig.StorageAccount)
                    {
                        #We found a StorageAccount in the role's diagnostics configuration.  Use it.
                        $publicConfigStorageAccountName = $publicConfig.PublicConfig.StorageAccount
                        Write-Verbose "Found PublicConfig.StorageAccount= '$publicConfigStorageAccountName'"

                        $publicConfigStorageKey = Get-AzStorageKey -StorageAccountName $publicConfigStorageAccountName -endpoint $endpoint
                        if ($publicConfigStorageKey)
                        {
                            Write-Verbose "##[command]New-AzureStorageContext -StorageAccountName $publicConfigStorageAccountName -StorageAccountKey <key>"
                            $storageContext = New-AzureStorageContext -StorageAccountName $publicConfigStorageAccountName -StorageAccountKey $publicConfigStorageKey.Primary
                        }
                        else
                        {
                            Write-Warning (Get-VstsLocString -Key "Couldnotgettheprimarystoragekeyforthepublicconfigstorageaccount0Unabletoapplyanydiagnosticsextensions" -ArgumentList "$publicConfigStorageAccountName")
                            return
                        }
                    }
                    else
                    {
                        #If we don't find a StorageAccount in the XML file, use the one associated with the definition's storage account
                        Write-Verbose "No StorageAccount found in PublicConfig.  Using the storage account set on the definition..."
                        $storageContext = $definitionStorageContext
                    }

                    Write-Host "New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageContext <context> -DiagnosticsConfigurationPath $fullExtPath"
                    $wadconfig = New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageContext $storageContext -DiagnosticsConfigurationPath $fullExtPath 

                    #Add each extension configuration to the array for use by caller
                    $diagnosticsConfigurations += $wadconfig
                }
            }
        }
        else
        {
            Write-Warning (Get-VstsLocString -Key "Couldnotgettheprimarystoragekeyforstorageaccount0Unabletoapplyanydiagnosticsextensions" -ArgumentList "$storageAccount")
        }
    }
    
    return $diagnosticsConfigurations
}