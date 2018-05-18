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

function Get-DiagnosticsExtensions($storageAccount, $extensionsPath, $storageAccountKeysMap)
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

                        if ($storageAccountKeysMap.containsKey($role))
                        {
                            Write-Verbose "##Getting diagnostics storage account name and key from passed as storage keys."

                            Write-Verbose "##$storageAccountName = $publicConfigStorageAccountName"
                            $storageAccountName = $publicConfigStorageAccountName
                            $storageAccountKey = $storageAccountKeysMap.Get_Item($role)
                        }
                        else
                        {
                            try
                            {
                                $publicConfigStorageKey = Get-AzureStorageKey -StorageAccountName $publicConfigStorageAccountName
                            }
                            catch
                            {   
                                Write-Host (Get-VstsLocString -Key "Unabletofind0usingprovidedsubscription" -ArgumentList "$publicConfigStorageAccountName")
                                Write-Verbose $_.Exception.Message
                            }
                            if ($publicConfigStorageKey)
                            {
                                Write-Verbose "##Getting storage account name and key from diagnostics config file"

                                Write-Verbose "##$storageAccountName = $publicConfigStorageAccountName"
                                $storageAccountName = $publicConfigStorageAccountName
                                $storageAccountKey = $publicConfigStorageKey.Primary
                                
                            }                    
                            else
                            {
                                Write-Warning (Get-VstsLocString -Key "Couldnotgettheprimarystoragekeyforthepublicconfigstorageaccount0Unabletoapplyanydiagnosticsextensions" -ArgumentList "$publicConfigStorageAccountName")
                                return
                            }
                        }
                    }
                    else
                    {
                        #If we don't find a StorageAccount in the XML file, use the one associated with the definition's storage account
                        Write-Verbose "No StorageAccount found in PublicConfig.  Using the storage account set on the definition..."
                        $storageAccountName = $storageAccount
                        $storageAccountKey = $primaryStorageKey
                    }

                    if((CmdletHasMember "StorageAccountName") -and (CmdletHasMember "StorageAccountKey"))
                    {
                        Write-Host "New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageAccountName $storageAccountName -StorageAccountKey <storageKey> -DiagnosticsConfigurationPath $fullExtPath"
                        $wadconfig = New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey -DiagnosticsConfigurationPath $fullExtPath
                    } 
                    else
                    {
                        try
                        {
                            $storageContext = New-AzureStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey
                            Write-Host "New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageContext $StorageContext -DiagnosticsConfigurationPath $fullExtPath"
                            $wadconfig = New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageContext $StorageContext -DiagnosticsConfigurationPath $fullExtPath 
                        }
                        catch
                        {
                            Write-Warning (Get-VstsLocString -Key "Currentversionofazurepowershelldontsupportexternalstorageaccountforconfiguringdiagnostics")
                            throw $_.Exception
                        }
                    }

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

function Parse-StorageKeys($storageAccountKeys)
{
    $roleStorageKeyMap = @{}
    if($storageAccountKeys)
    {
        $roleKeyPairs = $storageAccountKeys.split()
        foreach($roleKeyPair in $roleKeyPairs) 
        {
            if($roleKeyPair)
            {
                $roleKeyArray = $roleKeyPair.split(":")
                if($roleKeyArray.Length -ne 2) 
                {
                    throw (Get-VstsLocString -Key "Storagekeysaredefinedininvalidformat" -ArgumentList $pattern)
                }
                $roleStorageKeyMap.Add($roleKeyArray[0],$roleKeyArray[1])
            }
        }
    }
    return $roleStorageKeyMap
}

function CmdletHasMember($memberName) {
    try{
        $cmdletParameter = (gcm New-AzureServiceDiagnosticsExtensionConfig).Parameters.Keys.Contains($memberName)
        return $cmdletParameter
    }
    catch
    {
        return false;
    }  
}

function Parse-CustomCertificates($customCertificates)
{
    $certificateFilePasswordMap = @{}
    if($customCertificates)
    {
        $filePasswordPairs = $customCertificates.split()
        foreach($filePasswordPair in $filePasswordPairs) 
        {
            if($filePasswordPair)
            {
                $filePasswordArray = $filePasswordPair.split(":")
                if($filePasswordArray.Length -ne 2) 
                {
                    throw (Get-VstsLocString -Key "Customcertificatesaredefinedininvalidformat" -ArgumentList $pattern)
                }
                $certificateFilePasswordMap.Add($filePasswordArray[0],$filePasswordArray[1])
            }
        }
    }
    return $certificateFilePasswordMap
}

function Add-CustomCertificates($serviceName, $customCertificatesMap)
{
    if (!$customCertificatesMap)
    {
        Write-Verbose "No custom certificates configured"
    }
    else
    {
        foreach ($customCertificate in $customCertificatesMap.Keys)
        {
            Write-Host (Get-VstsLocString -Key "Addinganyconfiguredcustomcertificates")

            Write-Verbose "Saving a custom certificate to a temp file..."
            $tmpFile = New-TemporaryFile
            [System.IO.File]::WriteAllBytes($tmpFile.FullName, [System.Convert]::FromBase64String($customCertificate))
            Write-Verbose "Certificate saved"

            Write-Verbose "Uploading certificate..."
            Add-AzureCertificate -ServiceName $ServiceName -CertToDeploy $tmpFile.FullName -Password $customCertificatesMap.Item($customCertificate)
            Write-Verbose "Certificate uploaded"

            Remove-Item -Path $tmpFile.FullName -Force
            Write-Verbose "Deleted the temp file $tmpFile.FullName"
        }
    }
}
function Validate-ServiceStatus ($ServiceName, $Slot)
{
		$RoleInstances=$null;
		$deployment =$null;
	    $retryCount = 0;
		$readyRoleInstanceCount =0;
	    $timeout = 0;
	try{
		Write-Verbose "First check for  existence of Azure Cloud Service with Service Name: $ServiceName "
		if (Test-AzureName -Service -Name $ServiceName)
		{
			do
			{
				Write-Host "##[command]Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue -ErrorVariable azureDeploymentError"
				$azureDeployment = Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue -ErrorVariable azureDeploymentError
				if($azureDeploymentError){
					$retryCount = $retryCount + 1
					$azureDeploymentError | ForEach-Object { Write-Verbose $_.Exception.ToString() }
				}
				Write-Verbose "Found that the azure cloud Service exists with $ServiceName with Status=$($azureDeployment.Status)"
				if ($azureDeployment.Status -eq "Running")
				{
					Write-Host "##[command]Get-AzureRole -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue -ErrorVariable azureDeploymentError"
					$RoleInstances = Get-AzureRole -ServiceName $ServiceName -Slot $Slot -InstanceDetails -ErrorAction SilentlyContinue -ErrorVariable azureRoleError
					if($azureRoleError){
						$retryCount = $retryCount + 1
						$azureRoleError | ForEach-Object { Write-Verbose $_.Exception.ToString() }
					}
					if($RoleInstances)
					{
						Write-Verbose "Loop through all instances to find the role instance status as ReadyRole, instances count:  $($RoleInstances.Count)"
						foreach($instance in $RoleInstances)
						{
							$readyRoleInstanceCount=0
							Write-Verbose "Status for role $($instance.InstanceName) is: $($instance.InstanceStatus)"
							if($instance.InstanceStatus -ne "ReadyRole")
							{ 
								Write-Warning (Get-VstsLocString -Key Unabletofindservicestatus0 -ArgumentList $($instance.InstanceName))
							}
							else
							{
								Write-Host (Get-VstsLocString -Key EachInstancesNameAndStatus0 -ArgumentList $($instance.InstanceName))
								$readyRoleInstanceCount = $readyRoleInstanceCount + 1
							}
						}
						if($readyRoleInstanceCount -eq $RoleInstances.Count )
						{
							    Write-Host (Get-VstsLocString -Key AllInstancesReadyRole0status -ArgumentList $($RoleInstances.Count))
								break; 
						}
					}
					else
					{
						Write-Warning (Get-VstsLocString -Key Role0OrRoleInstanceNotfound -ArgumentList $ServiceName)
					}
				}
				else
				{
					if ($retryCount -gt 3)
					{
							Write-Host (Get-VstsLocString -Key RetryForService0Availablity)
							break;
					}
					Write-Host (Get-VstsLocString -Key WaitingForInstance0Beforefindstatus -ArgumentList $ServiceName) 
					Start-Sleep -Seconds 120
					$timeout = $timeout + 30
					if($timeout -gt 210)
					{
						Write-Host (Get-VstsLocString -Key WaitingForService0Available) 
						break;
					}
				}
			  } while($true)
		}
		else
		{
		    Write-Warning (Get-VstsLocString -Key ServiceNotFound0 -ArgumentList $ServiceName)
		}
	}
	catch [Exception]{
		$msg = $_.Exception.Message;
		Write-Warning $msg
		Write-Warning (Get-VstsLocString -Key ServiceNotFound0 -ArgumentList $ServiceName)
	}
}