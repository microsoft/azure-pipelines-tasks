function Get-SavedModuleContainerPath {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [bool]
        $isWin
    )

    if ($isWin) {
        return $env:SystemDrive + "\Modules";
    } else {
        return "/usr/share";
    }
}

function Test-IsHostedAgentPathPresent {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [bool]
        $isWin
    )

    $containerPath = Get-SavedModuleContainerPath -isWin $isWin
    return Test-Path (Join-Path $containerPath "az_*")
}

function Get-SavedModulePath {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [string]
        $azurePowerShellVersion,

        [Parameter(Mandatory = $true)]
        [bool]
        $isWin
    )

    $savedModulePath = Join-Path (Get-SavedModuleContainerPath -isWin $isWin) "az_$azurePowerShellVersion"
    Write-Verbose "The value of the module path is: $savedModulePath"
    return $savedModulePath 
}

function Expand-ModuleZip {
    param (
        [string] [Parameter(Mandatory = $true)]
        $zipPath,

        [string] [Parameter(Mandatory = $true)]
        $destination,

        [bool] [Parameter(Mandatory=$true)]
        $isWin
    )
    
    if ($isWin) {
        $parameter = @("x", "-o$destination", "$zipPath")
        $command = "$PSScriptRoot\7zip\7z.exe"
        &$command @parameter
    } else {
        $prevProgressPref = $ProgressPreference
        $ProgressPreference = 'SilentlyContinue'
        Expand-Archive -Path $zipPath -DestinationPath $destination
        $ProgressPreference = $prevProgressPref
    }
}

function Update-PSModulePathForHostedAgent {
    [CmdletBinding()]
    param([string] $targetAzurePs)
    try {
        if ($targetAzurePs) {
            $hostedAgentAzModulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs -isWin $true
        }
        else {
            $hostedAgentAzModulePath = Get-LatestModule -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        }
        $env:PSModulePath = $hostedAgentAzModulePath + ";" + $env:PSModulePath
        $env:PSModulePath = $env:PSModulePath.TrimStart(';') 
    } finally {
        Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
    }
}

function Update-PSModulePathForHostedAgentLinux {
    [CmdletBinding()]
    param([string] $targetAzurePs)
    try {
        if ($targetAzurePs) {
            $hostedAgentAzModulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs -isWin $false
            if(!(Test-Path $hostedAgentAzModulePath)) {
                Write-Verbose "No module path found with this name"
                throw ("Could not find the module path with given version.")
            }
        }
        else {
            $hostedAgentAzModulePath = Get-LatestModuleLinux -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        }
        $env:PSModulePath = $hostedAgentAzModulePath + ":" + $env:PSModulePath
        $env:PSModulePath = $env:PSModulePath.TrimStart(':') 
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

function Get-LatestModuleLinux {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)
    
    $resultFolder = ""
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
    $maxVersion = [version] "0.0.0"

    try {
        $moduleFolders = Get-ChildItem -Directory -Path $("/usr/share") | Where-Object { $regexToMatch.IsMatch($_.Name) }
        foreach ($moduleFolder in $moduleFolders) {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion) {
                $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"Az/$moduleVersion/Az.psm1")

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

function CleanUp-PSModulePathForHostedAgent {
     # Define the module paths to clean up
    $modulePaths = @(
        "C:\Modules\azurerm_2.1.0",
        "C:\\Modules\azurerm_2.1.0",
        "C:\Modules\azure_2.1.0",
        "C:\\Modules\azure_2.1.0"
    )

    # Clean up PSModulePath for hosted agent
    $azPSModulePath = $env:PSModulePath
    foreach ($modulePath in $modulePaths) {
        if ($azPSModulePath.split(";") -contains $modulePath) {
            $azPSModulePath = (($azPSModulePath).Split(";") | ? { $_ -ne $modulePath }) -join ";"
            Write-Verbose "$modulePath removed. Restart the prompt for the changes to take effect."
        }
        else {
            Write-Verbose "$modulePath is not present in $azPSModulePath"
        }
    }

    $env:PSModulePath = $azPSModulePath
}


function Get-MajorVersionOnAzurePackage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$moduleName
    )
    # GitHub API URL for Azure releases
    $url = "https://api.github.com/repos/Azure/${moduleName}/releases"
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get
        $majorReleases = $response
        If ($moduleName -eq 'azure-powershell') {
            $majorReleases = $response  | Where-Object { $_.tag_name -match '^v\d+\.\d+\.0' } | Sort-Object { $_.id } -Descending
        } 
        $lastOneRelease = $majorReleases | Select-Object -First 1
    } catch {
        Write-Verbose "Attempting to find the latest major release failed with the error: $($_.Exception.Message)"
    }
    return $lastOneRelease
}

function Get-LatestModuleFromCommonPath {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)

    $commonPaths = $env:PSModulePath -split ';'
    $maxVersion = [version] "0.0.0"
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract

    foreach ($path in $commonPaths) {
        $azModulePath = Join-Path $path $moduleName
        if (Test-Path $azModulePath) {
            Write-Verbose "Found Az module directory at: $azModulePath"
            $versions = Get-ChildItem -Directory -Path $modulePath | Where-Object { $regexToMatch.IsMatch($_.Name) }
            foreach ($versionDir in $versions) {
                $manifestPath = Join-Path $versionDir.FullName "$moduleName.psd1"
                $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
                if($moduleVersion -gt $maxVersion) {
                    if (Test-Path $manifestPath) {
                        $maxVersion = $moduleVersion
                    }
                }
            }
        }
    }
    return $maxVersion
}

function Get-InstalledMajorRelease {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$moduleName,
        [Parameter(Mandatory=$true)]
        [bool]$isWin
    )
    $version = ''
    $versionPattern = "[0-9]+\.[0-9]+\.[0-9]+"
    Write-Verbose "Attempting to find installed version of module: $moduleName"
    $isHostedAgent = Test-IsHostedAgentPathPresent -isWin $isWin
    if ($isHostedAgent) {
        if ($isWin) {
            $latestAzPath = Get-LatestModule -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        } else {
            $latestAzPath = Get-LatestModuleLinux -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        }
        if ($latestAzPath -and $latestAzPath -match $versionPattern -and $latestAzPath -ne '0.0.0') {
            $version = $Matches[0]
            Write-Debug "Found Az module version from hosted agent module path: $version"
            return $version
        }
    }
    try {
        $installedModule = Get-InstalledModule -Name $moduleName -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
        if ($installedModule) {
            $version = $installedModule.Version.ToString()
            Write-Debug "Found Az module version from Get-InstalledModule: $version"
            return $version
        }
    } catch {
        Write-Verbose "Get-InstalledModule failed: $($_.Exception.Message)"
    }
    try {
        # First try to get the Az module directly
        $azModule = Get-Module -Name $moduleName -ListAvailable -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
        if ($azModule) {
            $version = $azModule.Version.ToString()
            Write-Host "Found Az module version directly in Get-Module: $version"
            return $version
        }
        if (!$isHostedAgent) {
            $version = Get-LatestModuleFromCommonPath -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
            if ($version -and $version -ne '0.0.0') {
                # $version = $azModule.ToString()
                Write-Debug "Found Az module version For self hosted Agent: $version"
                return $version
            }
            throw ("Could not find the module version of $moduleName. Please ensure the Az module is installed on the agent.")
        }
    } catch {
        Write-Verbose "Az module specific detection failed: $($_.Exception.Message)"
    }
}

function Get-IsSpecifiedPwshAzVersionOlder{
    [CmdletBinding()]
    param([string] $specifiedVersion,
          [string] $latestRelease,
          [int] $versionsToReduce)

    $specifiedVersion = ($specifiedVersion -split '\.')[0]
    Write-Host "specifiedVersion : $specifiedVersion"
    Write-Host "latest Release: $latestRelease"
    if($latestRelease -match '(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)?'){
        $latestMajorRelease = $matches['major']
    }

    if(([int]$specifiedVersion) -le ([int]$latestMajorRelease-$versionsToReduce)){
        return $true
    }
    return $false
}

function Initialize-ModuleVersionValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$moduleName,
        [Parameter(Mandatory=$true)]
        [AllowEmptyString()]
        [string]$targetAzurePs,
        [Parameter(Mandatory=$true)]
        [string]$displayModuleName,
        [Parameter(Mandatory=$true)]
        [int]$versionsToReduce
    )
    try {
        $DisplayWarningForOlderAzVersion = Get-VstsPipelineFeature -FeatureName "ShowWarningOnOlderAzureModules"
        if ($DisplayWarningForOlderAzVersion -eq $true) {
            if ($targetAzurePs -eq "") {
                $targetAzurePs = Get-InstalledMajorRelease -moduleName $displayModuleName -isWin $true
            }
            $latestRelease = Get-MajorVersionOnAzurePackage -moduleName $moduleName
            if (Get-IsSpecifiedPwshAzVersionOlder -specifiedVersion $targetAzurePs -latestRelease $($latestRelease.tag_name) -versionsToReduce $versionsToReduce) {
                Write-Warning (Get-VstsLocString -Key Az_LowerVersionWarning -ArgumentList $displayModuleName, $targetAzurePs, $($latestRelease.tag_name))
            }       
        }
    } catch {
        Write-Verbose "Error while validating Az version: $($_.Exception.Message)"
    }
}