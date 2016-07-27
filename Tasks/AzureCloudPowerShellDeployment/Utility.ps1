function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw (Get-VstsLocString -Key "Foundmorethanonefiletodeploywithsearchpattern0Therecanbeonlyone" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-VstsLocString -Key "Nofileswerefoundtodeploywithsearchpattern0" -ArgumentList $pattern)
        }
        return $files
    }
}

#Filename= DiagnosticsExtension.WebRole1.PubConfig.xml returns WebRole1
#Filename= DiagnosticsExtension.Web.Role1.PubConfig.xml returns Web.Role1
#Role names can have dots in them
function Get-RoleName($extPath)
{
    $roleName = ""

    #The following statement uses the SimpleMatch option to direct the -split operator to interpret the dot (.) delimiter literally.
    #With the default, RegexMatch, the dot enclosed in quotation marks (".") is interpreted to match any character except for a newline
    #character. As a result, the Split statement returns a blank line for every character except newline.  The 0 represents the "return
    #all" value of the Max-substrings parameter. You can use options, such as SimpleMatch, only when the Max-substrings value is specified.
    $roles = $extPath -split ".",0,"simplematch"

    if ($roles -is [system.array] -and $roles.Length -gt 1)
    {
        $roleName = $roles[1] #base role name

        $x = 2
        while ($x -le $roles.Length)
        {
            if ($roles[$x] -ne "PubConfig")
            {
                $roleName = $roleName + "." + $roles[$x]
            }
            else
            {
                break
            }
            $x++
        }
    }
    else
    {
        Write-Warning (Get-VstsLocString -Key "_0couldnotbeparsedintopartsforregisteringdiagnosticsextensions" -ArgumentList $extPath)
    }

    return $roleName
}

function Get-DiagnosticsExtensions($storageAccount, $extensionsPath)
{
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
        $primaryStorageKey = (Get-AzureStorageKey -StorageAccountName "$storageAccount").Primary

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

                        $publicConfigStorageKey = Get-AzureStorageKey -StorageAccountName $publicConfigStorageAccountName
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