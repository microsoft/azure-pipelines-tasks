function Import-AzureModule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Azure', 'AzureRM')]
        [string[]]$PreferredModule,
        [string] $azurePsVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Env:PSModulePath: '$env:PSMODULEPATH'"
        if ($PreferredModule -contains 'Azure' -and $PreferredModule -contains 'AzureRM') {
            # Attempt to import Azure and AzureRM.
            $azure = (Import-FromModulePath -Classic:$true -azurePsVersion $azurePsVersion) -or (Import-FromSdkPath -Classic:$true -azurePsVersion $azurePsVersion)
            $azureRM = (Import-FromModulePath -Classic:$false -azurePsVersion $azurePsVersion) -or (Import-FromSdkPath -Classic:$false -azurePsVersion $azurePsVersion)
            if (!$azure -and !$azureRM) {
                throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList $azurePsVersion)
            }
        } elseif ($PreferredModule -contains 'Azure') {
            # Attempt to import Azure but fallback to AzureRM.
            if (!(Import-FromModulePath -Classic:$true -azurePsVersion $azurePsVersion) -and
                !(Import-FromSdkPath -Classic:$true -azurePsVersion $azurePsVersion) -and
                !(Import-FromModulePath -Classic:$false -azurePsVersion $azurePsVersion) -and
                !(Import-FromSdkPath -Classic:$false -azurePsVersion $azurePsVersion))
            {
                throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList $azurePsVersion)
            }
        } else {
            # Attempt to import AzureRM but fallback to Azure.
            if (!(Import-FromModulePath -Classic:$false -azurePsVersion $azurePsVersion) -and
                !(Import-FromSdkPath -Classic:$false -azurePsVersion $azurePsVersion) -and
                !(Import-FromModulePath -Classic:$true -azurePsVersion $azurePsVersion) -and
                !(Import-FromSdkPath -Classic:$true -azurePsVersion $azurePsVersion))
            {
                throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList $azurePsVersion)
            }
        }

        # Validate the Classic version.
        $minimumVersion = [version]'0.8.10.1'
        if ($script:azureModule -and $script:azureModule.Version -lt $minimumVersion) {
            throw (Get-VstsLocString -Key AZ_RequiresMinVersion0 -ArgumentList $minimumVersion)
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-FromModulePath {
    [CmdletBinding()]
    param(
        [switch]$Classic,
        [string] $azurePsVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Determine which module to look for.
        if ($Classic) {
            $name = "Azure"
        } else {
            $name = "AzureRM"
        }

        # Attempt to resolve the module.
        Write-Verbose "Attempting to find the module '$name' from the module path."
        if($azurePsVersion) {
            $module = Get-Module -Name $name -ListAvailable | Where-Object {$_.Version -eq $azurePsVersion} | Select-Object -First 1
        }
        else {
            $module = Get-Module -Name $name -ListAvailable | Sort-Object -Version -Descending | Select-Object -First 1
            $sdkVersion = Get-SdkVersion
            if($sdkVersion -and ($module.Version -lt $sdkVersion)) {
                return $false
            }
        }

        if (!$module) {
            return $false
        }

        # Import the module.
        Write-Host "##[command]Import-Module -Name $($module.Path) -RequiredVersion $($module.Version) -Global"
        $module = Import-Module -Name $module.Path -RequiredVersion $($module.Version) -Global -PassThru
        Write-Verbose "Imported module version: $($module.Version)"

        if ($Classic) {
            # Store the imported Azure module.
            $script:azureModule = $module
        } else {
            # The AzureRM module was imported.

            # Validate the AzureRM.profile module can be found.
            $profileModule = Get-Module -Name AzureRM.profile -ListAvailable | Select-Object -First 1
            if (!$profileModule) {
                throw (Get-VstsLocString -Key AZ_AzureRMProfileModuleNotFound)
            }

            # Import and then store the AzureRM.profile module.
            Write-Host "##[command]Import-Module -Name $($profileModule.Path) -Global"
            $script:azureRMProfileModule = Import-Module -Name $profileModule.Path -Global -PassThru
            Write-Verbose "Imported module version: $($script:azureRMProfileModule.Version)"
        }

        return $true
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-FromSdkPath {
    [CmdletBinding()]
    param([switch]$Classic,
          [string] $azurePsVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Classic) {
            $partialPath = 'Microsoft SDKs\Azure\PowerShell\ServiceManagement\Azure\Azure.psd1'
        } else {
            $partialPath = 'Microsoft SDKs\Azure\PowerShell\ResourceManager\AzureResourceManager\AzureRM.Profile\AzureRM.Profile.psd1'
        }

        foreach ($programFiles in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
            if (!$programFiles) {
                continue
            }

            $path = [System.IO.Path]::Combine($programFiles, $partialPath)
            Write-Verbose "Checking if path exists: $path"
            if (Test-Path -LiteralPath $path -PathType Leaf) {
                if ($azurePsVersion -and (-not ($(Get-SdkVersion) -eq $azurePsVersion))) {
                    continue
                }
                # Import the module.
                if($Classic) {
                    Write-Host "##[command]Import-Module -Name $path -Global"
                    $module = Import-Module -Name $path -Global -PassThru
                    Write-Verbose "Imported module version: $($module.Version)"                    
                }
                else {
                    Write-Host "##[command]Import-Module -Name $path -Global"
                    $module = Import-Module -Name $path -Global -PassThru
                    Write-Verbose "Imported module version: $($module.Version)"

                    $azureStorageModulePath = [System.IO.Path]::Combine($programFiles, "Microsoft SDKs\Azure\PowerShell\Storage\Azure.Storage\Azure.Storage.psd1")
                    Write-Host "##[command]Import-Module -Name $azureStorageModulePath -Global"
                    $azureStorageModule = Import-Module -Name $azureStorageModulePath -Global -PassThru
                    Write-Verbose "Imported module version: $($azureStorageModule.Version)"

                    $azureRmNestedModulesDirectory = Split-Path  -Parent (Split-Path -Parent $path)
                    $azureRmNestedModules = Get-ChildItem -Path $azureRmNestedModulesDirectory
                    foreach ($azureRmNestedModule in $azureRmNestedModules) {
                        if($azureRmNestedModule.Name -eq "AzureRM.Profile") {
                            continue;
                        }
                        $azureRmNestedModulePath = $azureRmNestedModule.FullName + "\" + $azureRmNestedModule.Name + ".psd1" 
                        try {
                            Write-Host "##[command]Import-Module -Name $azureRmNestedModulePath -Global"
                            $azureRmSubmodule = Import-Module -Name $azureRmNestedModulePath -Global -PassThru
                            Write-Verbose "Imported module version: $($azureRmSubmodule.Version)"
                        }
                        catch {
                            Write-Host $(Get-VstsLocString -Key AZ_AzureRmSubmoduleImportFailed -ArgumentList $azureRmNestedModulePath, $_.Exception.Message)
                        }
                    }
                }
                # Store the imported module.
                if ($Classic) {
                    $script:azureModule = $module
                } else {
                    $script:azureRMProfileModule = $module
                }

                return $true
            }
        }

        return $false
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-SdkVersion {
    Trace-VstsEnteringInvocation $MyInvocation
    try{
        $regKey = "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
        $installedApplications = Get-ItemProperty -Path $regKey
        $SdkVersion = ($installedApplications | Where-Object { $_.DisplayName -and $_.DisplayName.Contains("Microsoft Azure PowerShell") } | Select-Object -First 1).DisplayVersion
        return $SdkVersion
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}


