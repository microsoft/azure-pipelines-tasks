function CmdletHasMember {
    [cmdletbinding()]
    [OutputType([System.Boolean])]
    param(
        [string]$memberName
    )
    
    $publishParameters = (gcm Publish-TestResults).Parameters.Keys.Contains($memberName) 
    return $publishParameters
}

function SetRegistryKeyForParallel {    
    [cmdletbinding()]
    param(
        [string]$vsTestVersion
    )
    
    $regkey = "HKCU\SOFTWARE\Microsoft\VisualStudio\" + $vsTestVersion + "_Config\FeatureFlags\TestingTools\UnitTesting\Taef"
    reg add $regkey /v Value /t REG_DWORD /d 1 /f /reg:32 > $null
}

function IsVisualStudio2015Update1OrHigherInstalled {
    [cmdletbinding()]
    [OutputType([System.Boolean])]
    param(
        [string]$vsTestVersion
    )
    
    $version = [int]($vsTestVersion)
    if($version -ge 14)
    {
        # checking for dll introduced in vs2015 update1
        # since path of the dll will change in dev15+ using vstestversion>14 as a blanket yes
        if((Test-Path -Path "$env:VS140COMNTools\..\IDE\CommonExtensions\Microsoft\TestWindow\TE.TestModes.dll") -Or ($version -gt 14))
        {
            # ensure the registry is set otherwise you need to launch VSIDE
            SetRegistryKeyForParallel $vsTestVersion
            
            return $true
        }
    }
    
    return $false
}

function SetupRunSettingsFileForParallel {
    [cmdletbinding()]
    [OutputType([System.String])]
    param(
        [string]$runInParallelFlag,
        [string]$runSettingsFilePath,
        [string]$defaultCpuCount
    )

    if($runInParallelFlag -eq "True")
    {        
        $runSettingsForParallel = [xml]'<?xml version="1.0" encoding="utf-8"?>'
        if([System.String]::IsNullOrWhiteSpace($runSettingsFilePath) -Or (-Not [io.path]::HasExtension($runSettingsFilePath)))  # no file provided so create one and use it for the run
        {
            Write-Verbose "No runsettings file provided"
            $runSettingsForParallel = [xml]'<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <RunConfiguration>
    <MaxCpuCount>0</MaxCpuCount>
  </RunConfiguration>
</RunSettings>
'
        }
        else 
        { 
            Write-Verbose "Adding maxcpucount element to runsettings file provided"
            $runSettingsForParallel = [System.Xml.XmlDocument](Get-Content $runSettingsFilePath)
            $runConfigurationElement = $runSettingsForParallel.SelectNodes("//RunSettings/RunConfiguration")
            if($runConfigurationElement.Count -eq 0)
            {
                $runConfigurationElement = $runSettingsForParallel.RunSettings.AppendChild($runSettingsForParallel.CreateElement("RunConfiguration"))
            }

            $maxCpuCountElement = $runSettingsForParallel.SelectNodes("//RunSettings/RunConfiguration/MaxCpuCount")
            if($maxCpuCountElement.Count -eq 0)
            {
                $newMaxCpuCountElement = $runConfigurationElement.AppendChild($runSettingsForParallel.CreateElement("MaxCpuCount"))
            }    
        }

        $runSettingsForParallel.RunSettings.RunConfiguration.MaxCpuCount = $defaultCpuCount
        $tempFile = [io.path]::GetTempFileName()
        $runSettingsForParallel.Save($tempFile)
        Write-Verbose "Temporary runsettings file created at $tempFile"
        return $tempFile
    }
    return $runSettingsFilePath
}

