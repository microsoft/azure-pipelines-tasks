function Get-SqlPackageOnTargetMachine
{
    try
    {
        $sqlDacPath, $sqlVersion = Locate-HighestVersionSqlPackageWithSql
        $sqlVersionNumber = [decimal] $sqlVersion
    }
    catch [System.Exception]
    {
        Write-Verbose ("Failed to get Dac Framework (installed with SQL Server) location with exception: " + $_.Exception.Message)
        $sqlVersionNumber = 0
    }

	try
    {
        $sqlMsiDacPath, $sqlMsiVersion = Locate-HighestVersionSqlPackageWithDacMsi
        $sqlMsiVersionNumber = [decimal] $sqlMsiVersion
    }
    catch [System.Exception]
    {
        Write-Verbose ("Failed to get Dac Framework (installed with DAC Framework) location with exception: " + $_.Exception.Message) -verbose
        $sqlMsiVersionNumber = 0
    }

    try
    {
        $vsDacPath, $vsVersion = Locate-HighestVersionSqlPackageInVS
        $vsVersionNumber = [decimal] $vsVersion
    }
    catch [System.Exception]
    {
        Write-Verbose ("Failed to get Dac Framework (installed with Visual Studio) location with exception: " + $_.Exception.Message)
        $vsVersionNumber = 0
    }

    $maximumVersion = [decimal]$(@($vsVersionNumber, $sqlVersionNumber, $sqlMsiVersionNumber) | Measure-Object -Maximum).Maximum 

    if ($sqlMsiVersion -eq $maximumVersion)
    {
        $dacPath = $sqlMsiDacPath
    }
    elseif ($vsVersionNumber -eq $maximumVersion)
    {
        $dacPath = $vsDacPath
    }
    elseif ($sqlVersionNumber -eq $maximumVersion) 
    {
        $dacPath = $sqlDacPath
    }

    if ($dacPath -eq $null)
    {
        throw  "Unable to find the location of Dac Framework (SqlPackage.exe) from registry on machine $env:COMPUTERNAME"
    }
    else
    {
        return $dacPath
    }
}

function Get-RegistryValueIgnoreError
{
    param
    (
        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryHive]
        $RegistryHive,

        [parameter(Mandatory = $true)]
        [System.String]
        $Key,

        [parameter(Mandatory = $true)]
        [System.String]
        $Value,

        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryView]
        $RegistryView
    )

    try
    {
        $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($RegistryHive, $RegistryView)
        $subKey =  $baseKey.OpenSubKey($Key)
        if($subKey -ne $null)
        {
            return $subKey.GetValue($Value)
        }
    }
    catch
    {
    }
    return $null
}

function Get-RegistrySubKeysIgnoreError
{
    param
    (
        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryHive]
        $RegistryHive,

        [parameter(Mandatory = $true)]
        [System.String]
        $Key,

        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryView]
        $RegistryView
    )

    try
    {
        $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($RegistryHive, $RegistryView)
        $subKey =  $baseKey.OpenSubKey($Key)
        return $subKey
    }
    catch
    {
    }

    return $null
}

function Get-SubKeysInFloatFormat($keys)
{
    $targetKeys = @() 
        foreach ($key in $keys) 
        {		  
            try {
                $targetKeys += [decimal] $key
            }
            catch {}
        }
   
    $targetKeys    
}

function Get-SqlPackageForSqlVersion([int] $majorVersion, [bool] $wow6432Node)
{
    $sqlInstallRootRegKey = "SOFTWARE", "Microsoft", "Microsoft SQL Server", "$majorVersion" -join [System.IO.Path]::DirectorySeparatorChar

    if ($wow6432Node -eq $true)
    {
        $sqlInstallRootPath = Get-RegistryValueIgnoreError LocalMachine "$sqlInstallRootRegKey" "VerSpecificRootDir" Registry64
    }
    else
    {        
        $sqlInstallRootPath = Get-RegistryValueIgnoreError LocalMachine "$sqlInstallRootRegKey" "VerSpecificRootDir" Registry32
    }
    
    if ($sqlInstallRootPath -eq $null)
    {
        return $null
    }
    
    Write-Verbose "Sql Version Specific Root Dir for version $majorVersion as read from registry: $sqlInstallRootPath"    
        
    $DacInstallPath = [System.IO.Path]::Combine($sqlInstallRootPath, "Dac", "bin", "SqlPackage.exe")

    if (Test-Path $DacInstallPath)
    {
        Write-Verbose "Dac Framework installed with SQL Version $majorVersion found at $DacInstallPath on machine $env:COMPUTERNAME"
        return $DacInstallPath
    }
    else
    {
        return $null
    }
}

function Locate-HighestVersionSqlPackageWithSql()
{
    $sqlRegKey = "HKLM:", "SOFTWARE", "Wow6432Node", "Microsoft", "Microsoft SQL Server"-join [System.IO.Path]::DirectorySeparatorChar
    $sqlRegKey64 = "HKLM:", "SOFTWARE", "Microsoft", "Microsoft SQL Server"-join [System.IO.Path]::DirectorySeparatorChar

    if (-not (Test-Path $sqlRegKey))
    {
        $sqlRegKey = $sqlRegKey64
    }

    if (-not (Test-Path $sqlRegKey))
    {
        return $null, 0
    }

    $keys = Get-Item $sqlRegKey | %{$_.GetSubKeyNames()} 
    $versions = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending

    Write-Verbose "Sql Versions installed on machine $env:COMPUTERNAME as read from registry: $versions"        

    foreach ($majorVersion in $versions) 
    {
        $DacInstallPathWow6432Node = Get-SqlPackageForSqlVersion $majorVersion $true
        $DacInstallPath = Get-SqlPackageForSqlVersion $majorVersion $false

        if ($DacInstallPathWow6432Node -ne $null)
        {            
            return $DacInstallPathWow6432Node, $majorVersion
        }
        elseif ($DacInstallPath -ne $null)
        {
            return $DacInstallPath, $majorVersion
        }
    }

    Write-Verbose "Dac Framework (installed with SQL) not found on machine $env:COMPUTERNAME"      

    return $null, 0
}

function Locate-HighestVersionSqlPackageWithDacMsi()
{
    $sqlDataTierFrameworkRegKeyWow = "HKLM:", "SOFTWARE", "Wow6432Node", "Microsoft", "Microsoft SQL Server", "Data-Tier Application Framework" -join [System.IO.Path]::DirectorySeparatorChar
    $sqlDataTierFrameworkRegKey = "HKLM:", "SOFTWARE", "Microsoft", "Microsoft SQL Server", "Data-Tier Application Framework" -join [System.IO.Path]::DirectorySeparatorChar

    if (-not (Test-Path $sqlDataTierFrameworkRegKey))
    {
        $sqlDataTierFrameworkRegKey = $sqlDataTierFrameworkRegKeyWow
    }

    if ((Test-Path $sqlDataTierFrameworkRegKey))
    {
        $keys = Get-Item $sqlDataTierFrameworkRegKey | %{$_.GetSubKeyNames()} 
        $versions = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending
        $installedMajorVersion = 0

        foreach ($majorVersion in $versions)
        {
            $sqlInstallRootRegKey = "SOFTWARE", "Microsoft", "Microsoft SQL Server", "Data-Tier Application Framework", "$majorVersion" -join [System.IO.Path]::DirectorySeparatorChar
            $sqlInstallRootPath64 = Get-RegistryValueIgnoreError LocalMachine "$sqlInstallRootRegKey" "InstallDir" Registry64
            $sqlInstallRootPath32 = Get-RegistryValueIgnoreError LocalMachine "$sqlInstallRootRegKey" "InstallDir" Registry32
            if ($sqlInstallRootPath64 -ne $null)
            {
                $sqlInstallRootPath = $sqlInstallRootPath64
                break
            }
            if ($sqlInstallRootPath32 -ne $null)
            {
                $sqlInstallRootPath = $sqlInstallRootPath32
                break
            }
        }

        $DacInstallPath = [System.IO.Path]::Combine($sqlInstallRootPath, "SqlPackage.exe")
        
        if (Test-Path $DacInstallPath)
        {
            Write-Verbose "Dac Framework installed with SQL Version $majorVersion found at $DacInstallPath on machine $env:COMPUTERNAME"
            return $DacInstallPath, $majorVersion
        }
    }

    $sqlRegKeyWow = "HKLM:", "SOFTWARE", "Wow6432Node", "Microsoft", "Microsoft SQL Server", "DACFramework", "CurrentVersion" -join [System.IO.Path]::DirectorySeparatorChar
    $sqlRegKey = "HKLM:", "SOFTWARE", "Microsoft", "Microsoft SQL Server", "DACFramework", "CurrentVersion" -join [System.IO.Path]::DirectorySeparatorChar

	$sqlKey = "SOFTWARE", "Microsoft", "Microsoft SQL Server", "DACFramework", "CurrentVersion" -join [System.IO.Path]::DirectorySeparatorChar
	
    if (Test-Path $sqlRegKey)
    {
        $dacVersion = Get-RegistryValueIgnoreError LocalMachine "$sqlKey" "Version" Registry64
        $majorVersion = $dacVersion.Substring(0, $dacVersion.IndexOf(".")) + "0"
    }
    
    if (Test-Path $sqlRegKeyWow)
    {
        $dacVersionX86 = Get-RegistryValueIgnoreError LocalMachine "$sqlKey" "Version" Registry32
        $majorVersionX86 = $dacVersionX86.Substring(0, $dacVersionX86.IndexOf(".")) + "0"
    }

	if ((-not($dacVersion)) -and (-not($dacVersionX86)))
	{
	    Write-Verbose "Dac Framework (installed with DAC Framework) not found on machine $env:COMPUTERNAME"   
	    return $null, 0
	}    

    if ($majorVersionX86 -gt $majorVersion)
    {
        $majorVersion = $majorVersionX86
    }

	$dacRelativePath = "Microsoft SQL Server", "$majorVersion", "DAC", "bin", "SqlPackage.exe" -join [System.IO.Path]::DirectorySeparatorChar
	$programFiles = $env:ProgramFiles
	$programFilesX86 = "${env:ProgramFiles(x86)}"

	if (-not ($programFilesX86 -eq $null))
	{
	    $dacPath = $programFilesX86, $dacRelativePath -join [System.IO.Path]::DirectorySeparatorChar

		if (Test-Path("$dacPath"))
		{
            Write-Verbose "Dac Framework (installed with DAC Framework Msi) found on machine $env:COMPUTERNAME at $dacPath"  
            return $dacPath, $majorVersion
		}		
	}

	if (-not ($programFiles -eq $null))
	{
	    $dacPath = $programFiles, $dacRelativePath -join [System.IO.Path]::DirectorySeparatorChar

		if (Test-Path($dacPath))
		{
            Write-Verbose "Dac Framework (installed with DAC Framework Msi) found on machine $env:COMPUTERNAME at $dacPath"  
            return $dacPath, $majorVersion
		}		
	}
    
    return $null, 0
}

function Locate-SqlPackageInVS_15_0()
{
    $vs15 = Get-VisualStudio_15_0
    if ($vs15 -and $vs15.installationPath) {
        # End with "\" for consistency with old ShellFolder values.
        $shellFolder15 = $vs15.installationPath.TrimEnd('\'[0]) + "\"

        # Test for the DAC directory.
        $dacParentDir = [System.IO.Path]::Combine($shellFolder15, 'Common7', 'IDE', 'Extensions', 'Microsoft', 'SQLDB', 'DAC')
        $dacInstallPath, $dacInstallVersion = Get-LatestVersionSqlPackageInDacDirectory -dacParentDir $dacParentDir
        
        if($dacInstallPath)
        {
            return $dacInstallPath, $dacInstallVersion
        }
    }

    return $null, 0
}

function Locate-SqlPackageInVS([string] $version)
{
    $vsRegKeyForVersion = "SOFTWARE", "Microsoft", "VisualStudio", $version -join [System.IO.Path]::DirectorySeparatorChar

    $vsInstallDir = Get-RegistryValueIgnoreError LocalMachine "$vsRegKeyForVersion" "InstallDir" Registry64

    if ($vsInstallDir -eq $null)
    {
        $vsInstallDir = Get-RegistryValueIgnoreError LocalMachine "$vsRegKeyForVersion"  "InstallDir" Registry32
    } 

    if ($vsInstallDir)
    {
        Write-Verbose "Visual Studio install location: $vsInstallDir" 

        $dacExtensionPath = [System.IO.Path]::Combine("Extensions", "Microsoft", "SQLDB", "DAC")
        $dacParentDir = [System.IO.Path]::Combine($vsInstallDir, $dacExtensionPath)
        $dacInstallPath, $dacInstallVersion = Get-LatestVersionSqlPackageInDacDirectory -dacParentDir $dacParentDir
            
        if($dacInstallPath)
        {
            return $dacInstallPath, $dacInstallVersion
        }
    }

    return $null, 0
}

function Get-LatestVersionSqlPackageInDacDirectory([string] $dacParentDir)
{
    if (Test-Path $dacParentDir)
    {
        $dacVersion = "150"
        $dacFullPath = [System.IO.Path]::Combine($dacParentDir, "SqlPackage.exe")

        if(Test-Path $dacFullPath -pathtype leaf)
        {
            Write-Verbose "Dac Framework $dacVersion installed with Visual Studio found at $dacFullPath on machine $env:COMPUTERNAME"
            return $dacFullPath, $dacVersion
        }

        $dacVersionDirs = Get-ChildItem $dacParentDir | Sort-Object @{e={$_.Name -as [int]}} -Descending

        foreach ($dacVersionDir in $dacVersionDirs) 
        {
            $dacVersion = $dacVersionDir.Name
            $dacFullPath = [System.IO.Path]::Combine($dacVersionDir.FullName, "SqlPackage.exe")

            if(Test-Path $dacFullPath -pathtype leaf)
            {
                Write-Verbose "Dac Framework installed with Visual Studio found at $dacFullPath on machine $env:COMPUTERNAME"
                return $dacFullPath, $dacVersion
            }
            else
            {
                Write-Verbose "Unable to find Dac framework installed with Visual Studio at $($dacVersionDir.FullName) on machine $env:COMPUTERNAME"
            }
        }
    }

    return $null, 0
}

function Locate-HighestVersionSqlPackageInVS()
{
    # Locate SqlPackage.exe in VS 15.0
    $dacFullPath, $dacVersion = Locate-SqlPackageInVS_15_0

    if ($dacFullPath -ne $null)
    {
        return $dacFullPath, $dacVersion
    }

    #Locate SqlPackage.exe in older version 
    $vsRegKey = "HKLM:", "SOFTWARE", "Wow6432Node", "Microsoft", "VisualStudio" -join [System.IO.Path]::DirectorySeparatorChar
    $vsRegKey64 = "HKLM:", "SOFTWARE", "Microsoft", "VisualStudio" -join [System.IO.Path]::DirectorySeparatorChar

    if (-not (Test-Path $vsRegKey))
    {
        $vsRegKey = $vsRegKey64
    }

    if (-not (Test-Path $vsRegKey))
    {
        Write-Verbose "Visual Studio not found on machine $env:COMPUTERNAME"     
        return $null, 0
    }

    $keys = Get-Item $vsRegKey | %{$_.GetSubKeyNames()} 
    $versions = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending 

    Write-Verbose "Visual Studio versions found on machine $env:COMPUTERNAME as read from registry: $versions"        

    foreach ($majorVersion in $versions)
    {
        $dacFullPath, $dacVersion = Locate-SqlPackageInVS $majorVersion

        if ($dacFullPath -ne $null)
        {
            return $dacFullPath, $dacVersion
        }
    }

    Write-Verbose "Dac Framework (installed with Visual Studio) not found on machine $env:COMPUTERNAME "     

    return $null, 0
}

function Get-VisualStudio_15_0 {
    [CmdletBinding()]
    param()

    $visualStudioInstallDir = $null
    try {
        # Query for the latest 15.* version.
        #
        # Note, the capability is registered as VisualStudio_15.0, however the actual version
        # may be something like 15.2.
        Write-Verbose "Getting latest Visual Studio 15 setup instance."
        $output = New-Object System.Text.StringBuilder
        Invoke-VstsTool -FileName "$PSScriptRoot\vswhere.exe" -Arguments "-version [15.0,18.0) -latest -format json" -RequireExitCodeZero 2>&1 |
            ForEach-Object {
                if ($_ -is [System.Management.Automation.ErrorRecord]) {
                    Write-Verbose "STDERR: $($_.Exception.Message)"
                }
                else {
                    Write-Verbose $_
                    $null = $output.AppendLine($_)
                }
            }
        $visualStudioInstallDir = (ConvertFrom-Json -InputObject $output.ToString()) |
            Select-Object -First 1
        if (!$visualStudioInstallDir) {
            # Query for the latest 15.* BuildTools.
            #
            # Note, whereas VS 15.x version number is always 15.0.*, BuildTools does not follow the
            # the same scheme. It appears to follow the 15.<UPDATE_NUMBER>.* versioning scheme.
            Write-Verbose "Getting latest BuildTools 15 setup instance."
            $output = New-Object System.Text.StringBuilder
            Invoke-VstsTool -FileName "$PSScriptRoot\vswhere.exe" -Arguments "-version [15.0,18.0) -products Microsoft.VisualStudio.Product.BuildTools -latest -format json" -RequireExitCodeZero 2>&1 |
                ForEach-Object {
                    if ($_ -is [System.Management.Automation.ErrorRecord]) {
                        Write-Verbose "STDERR: $($_.Exception.Message)"
                    }
                    else {
                        Write-Verbose $_
                        $null = $output.AppendLine($_)
                    }
                }
            $visualStudioInstallDir  = (ConvertFrom-Json -InputObject $output.ToString()) |
                Select-Object -First 1
        }
    } catch {
        Write-Verbose ($_ | Out-String)
        $visualStudioInstallDir = $null
    }
    
    return $visualStudioInstallDir
}

function Get-SQLPackagePath
{
 
    $sqlPackage = Get-SqlPackageOnTargetMachine
  
    return $sqlPackage
}
