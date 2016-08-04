function CmdletHasMember {
	[cmdletbinding()]
	[OutputType([System.Boolean])]
	param(
		[string]$memberName
	)
	
	$publishParameters = (gcm Publish-TestResults).Parameters.Keys.Contains($memberName) 
	return $publishParameters
}

function InvokeVsTestCmdletHasMember {
	[cmdletbinding()]
	[OutputType([System.Boolean])]
	param(
		[string]$memberName
	)
	
	$invokeVstestParams = (gcm Invoke-VSTest).Parameters.Keys.Contains($memberName) 
	return $invokeVstestParams
}

function ShouldAddDiagFlag { 
	[cmdletbinding()]
	[OutputType([System.Boolean])]
	param(
		[string]$vsTestVersion
	)

	$inDebugMode = [system.boolean] (Get-ChildItem -path env:system_debug -erroraction silent)
	
	if($inDebugMode -eq $true) {
		
		$hasDiagFileNameParam = InvokeVsTestCmdletHasMember -memberName "DiagFileName"

		if($hasDiagFileNameParam) {
			if ([string]::IsNullOrWhiteSpace($vsTestVersion)) {
				$vsTestVersion = Get-VSVersion
			}
			
			$version = [int]($vsTestVersion)
			if($version -ge 15) {
				return $true
			}
		}
	} 

	return $false
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
	
	if ([string]::IsNullOrWhiteSpace($vsTestVersion)){
		$vsTestVersion = Get-VSVersion
	}
	
	$version = [int]($vsTestVersion)
	# with dev15 we are back to vstest and away from taef
	if($version -ge 15)
	{
		return $true
	}

	if($version -eq 14)
	{
		# checking for dll introduced in vs2015 update1
		# since path of the dll will change in dev15+ using vstestversion>14 as a blanket yes
		$teModesDll = [io.path]::Combine($env:VS140COMNTools, "..", "IDE", "CommonExtensions", "Microsoft", "TestWindow", "TE.TestModes.dll");
		if(Test-Path -Path $teModesDll)
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
		if([string]::Compare([io.path]::GetExtension($runSettingsFilePath), ".testsettings", $True) -eq 0)
		{
			Write-Warning "Run in Parallel is not supported with testsettings file."
		}
		else
		{
			$runSettingsForParallel = [xml]'<?xml version="1.0" encoding="utf-8"?>'
			if([System.String]::IsNullOrWhiteSpace($runSettingsFilePath) -Or ([string]::Compare([io.path]::GetExtension($runSettingsFilePath), ".runsettings", $True) -ne 0) -Or (Test-Path $runSettingsFilePath -pathtype container))  # no file provided so create one and use it for the run
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
	}
	
	return $runSettingsFilePath
}

function Get-SubKeysInFloatFormat($keys)
{
	$targetKeys = @()      # New array
	foreach ($key in $keys)
	{
		$targetKeys += $key -as [decimal]
	}

	return $targetKeys
}

function Get-VSVersion()
{
	#Find the latest version
	$regPath = "HKLM:\SOFTWARE\Microsoft\VisualStudio"
	if (-not (Test-Path $regPath))
	{
		return $null
	}
	
	$keys = Get-Item $regPath | %{$_.GetSubKeyNames()} -ErrorAction SilentlyContinue
	$version = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending | Select-Object -First 1

	if ([string]::IsNullOrWhiteSpace($version))
	{
		return $null
	}
	return $version
}

function Get-ResultsLocation {
	[cmdletbinding()]
	[OutputType([System.String])]
	param(		
		[string]$runSettingsFilePath		
	)

    # If this is a runsettings file then try to get the custom results location from it
    
    if(!(CheckIfDirectory $runSettingsFilePath) -And (CheckIfRunsettings $runSettingsFilePath))
    {
        $runSettingsForTestResults = [System.Xml.XmlDocument](Get-Content $runSettingsFilePath)
        $resultsDirElement = $runSettingsForTestResults.SelectNodes("//RunSettings/RunConfiguration/ResultsDirectory")

        if($resultsDirElement -And $resultsDirElement.Count -ne 0)
        {
            $customLocation = $runSettingsForTestResults.RunSettings.RunConfiguration.ResultsDirectory       
            if([io.path]::IsPathRooted($customLocation))
            {
                return $customLocation
            }
            else
            {
				if(![string]::IsNullOrWhiteSpace($customLocation))
				{
					# Resutls directory is relative to the location of runsettings
					return [io.path]::GetFullPath([io.path]::Combine([io.path]::GetDirectoryName($runSettingsFilePath), $customLocation))
				}
            }
        }        
    }

    return $null
}

function CheckIfRunsettings($runSettingsFilePath)
{
    if(([string]::Compare([io.path]::GetExtension($runSettingsFilePath), ".runsettings", $True) -eq 0) -Or ([string]::Compare([io.path]::GetExtension($runSettingsFilePath), ".tmp", $True) -eq 0))
    {
        return $true
    }
    return $false
}

function CheckIfDirectory($filePath)
{
    if(Test-Path $filePath -pathtype container)
    {
        return $true
    }
    return $false
}