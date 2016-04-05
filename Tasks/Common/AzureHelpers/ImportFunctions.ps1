function Import-AzureModule {
    [CmdletBinding()]
    param([switch]$PreferAzureRM)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Env:PSModulePath: '$env:PSMODULEPATH'"
        if ($PreferAzureRM) {
            if (!(Import-FromModulePath -Classic:$false) -and
                !(Import-FromSdkPath -Classic:$false) -and
                !(Import-FromModulePath -Classic:$true) -and
                !(Import-FromSdkPath -Classic:$true))
            {
                throw (Get-VstsLocString -Key AZ_ModuleNotFound)
            }
        } else {
            if (!(Import-FromModulePath -Classic:$true) -and
                !(Import-FromSdkPath -Classic:$true) -and
                !(Import-FromModulePath -Classic:$false) -and
                !(Import-FromSdkPath -Classic:$false))
            {
                throw (Get-VstsLocString -Key AZ_ModuleNotFound)
            }
        }

        # Validate the Classic version.
        $minimumVersion = [version]'0.8.10.1'
        if ($script:isClassic -and $script:classicVersion -lt $minimumVersion) {
            throw (Get-VstsLocString -Key AZ_RequiresMinVersion0 -ArgumentList $minimumVersion)
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-FromModulePath {
    [CmdletBinding()]
    param(
        [switch]$Classic)

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
        $module = Get-Module -Name $name -ListAvailable | Select-Object -First 1
        if (!$module) {
            return $false
        }

        # Import the module.
        Write-Host "##[command]Import-Module -Name $($module.Path) -Global"
        $module = Import-Module -Name $module.Path -Global -PassThru
        Write-Verbose "Imported module version: $($module.Version)"

        # Store the mode.
        $script:isClassic = $Classic.IsPresent

        if ($script:isClassic) {
            # The Azure module was imported.
            $script:classicVersion = $module.Version
        } else {
            # The AzureRM module was imported.

            # Validate the AzureRM.profile module can be found.
            $profileModule = Get-Module -Name AzureRM.profile -ListAvailable | Select-Object -First 1
            if (!$profileModule) {
                throw (Get-VstsLocString -Key AZ_AzureRMProfileModuleNotFound)
            }

            # Import the AzureRM.profile module.
            Write-Host "##[command]Import-Module -Name $($profileModule.Path) -Global"
            $profileModule = Import-Module -Name $profileModule.Path -Global -PassThru
            Write-Verbose "Imported module version: $($profileModule.Version)"
        }

        return $true
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-FromSdkPath {
    [CmdletBinding()]
    param([switch]$Classic)

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
                # Import the module.
                Write-Host "##[command]Import-Module -Name $path -Global"
                $module = Import-Module -Name $path -Global -PassThru
                Write-Verbose "Imported module version: $($module.Version)"

                # Store the mode.
                $script:isClassic = $Classic.IsPresent

                if ($Classic) {
                    # The Azure module was imported.
                    $script:classicVersion = $module.Version
                }

                return $true
            }
        }

        return $false
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
