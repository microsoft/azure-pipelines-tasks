
function Get-MSDeployOnTargetMachine
{
    try
    {
        $MSDeployPath, $MSDeployVersion = Locate-HighestVersionMsDeployPackage
        $MSDeployVersionNumber = [decimal] $MSDeployVersion
    }
    catch [System.Exception]
    {
        Write-Verbose ("Failed to get MS Deploy location with exception: " + $_.Exception.Message)
        $MSDeployVersionNumber = 0
    }

    if ($MSDeployPath -eq $null)
    {
        throw  "Unable to find the location of MS Deploy from registry on machine $env:COMPUTERNAME"
    }
    else
    {
        return $MSDeployPath
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

function Get-MSDeployPackage([int] $majorVersion, [bool] $wow6432Node)
{
    $MSDeployInstallRootRegKey = "SOFTWARE", "Microsoft", "IIS Extensions", "MSDeploy", "$majorVersion" -join [System.IO.Path]::DirectorySeparatorChar

    if ($wow6432Node -eq $true)
    {
        $MSDeployInstallRootPath = Get-RegistryValueIgnoreError LocalMachine "$MSDeployInstallRootRegKey" "InstallPath" Registry64
    }
    else
    {        
        $MSDeployInstallRootPath = Get-RegistryValueIgnoreError LocalMachine "$MSDeployInstallRootRegKey" "InstallPath" Registry32
    }
    
    if ($MSDeployInstallRootPath -eq $null)
    {
        return $null
    }
    
    Write-Verbose "MSDeploy Version Specific Root Dir for version $majorVersion as read from registry: $MSDeployInstallRootPath"    
        
    $MSDeployInstallPath = [System.IO.Path]::Combine($MSDeployInstallRootPath, "msdeploy.exe")

    if (Test-Path $MSDeployInstallPath)
    {
        Write-Verbose "MSDeploy installed with Version $majorVersion found at $MSDeployInstallPath on machine $env:COMPUTERNAME"
        return $MSDeployInstallPath
    }
    else
    {
        return $null
    }
}

function Locate-HighestVersionMsDeployPackage()
{
    $MSDeployRegKey = "HKLM:", "SOFTWARE", "Wow6432Node", "Microsoft", "IIS Extensions", "MSDeploy" -join [System.IO.Path]::DirectorySeparatorChar
    $MSDeployRegKey64 = "HKLM:", "SOFTWARE", "Microsoft", "IIS Extensions", "MSDeploy" -join [System.IO.Path]::DirectorySeparatorChar

    if (-not (Test-Path $MSDeployRegKey))
    {
        $MSDeployRegKey = $MSDeployRegKey64
    }

    if (-not (Test-Path $MSDeployRegKey))
    {
        return $null, 0
    }

    $keys = Get-Item $MSDeployRegKey | %{$_.GetSubKeyNames()} 
    $versions = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending

    Write-Verbose "MSDeploy Versions installed on machine $env:COMPUTERNAME as read from registry: $versions"        

    foreach ($majorVersion in $versions) 
    {
        $MSDeployInstallPathWow6432Node = Get-MSDeployPackage $majorVersion $true
        $MSDeployInstallPath = Get-MSDeployPackage $majorVersion $false

        if ($MSDeployInstallPathWow6432Node -ne $null)
        {            
            return $MSDeployInstallPathWow6432Node, $majorVersion
        }
        elseif ($MSDeployInstallPath -ne $null)
        {
            return $MSDeployInstallPath, $majorVersion
        }
    }

    Write-Verbose "MSDeploy not found on machine $env:COMPUTERNAME"      

    return $null, 0
}