function Test-Container {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$LiteralPath)

    Write-Host "Testing container: '$LiteralPath'"
    if ((Test-Path -LiteralPath $LiteralPath -PathType Container)) {
        Write-Host 'Exists.'
        return $true
    }
    Write-Host 'Does not exist.'
    return $false
}



function Test-Leaf {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$LiteralPath)

    Write-Host "Testing leaf: '$LiteralPath'"
    if ((Test-Path -LiteralPath $LiteralPath -PathType Leaf)) {
        Write-Host 'Exists.'
        return $true
    }
    Write-Host 'Does not exist.'
    return $false
}

function Get-VSTestConsole15Path {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path)

    $shellFolder15 = $Path.TrimEnd('\'[0]) + '\'
    $installDir15 = ([System.IO.Path]::Combine($shellFolder15, 'Common7', 'IDE')) + '\'
    $testWindowDir15 = [System.IO.Path]::Combine($installDir15, 'CommonExtensions', 'Microsoft', 'TestWindow') + '\'
    $vstestConsole15 = [System.IO.Path]::Combine($testWindowDir15, 'vstest.console.exe')
    return $vstestConsole15
}

function Get-VisualStudio_15_0 {

    [CmdletBinding()]

    param()



    try {

        # Short-circuit if the setup configuration class ID isn't registered.

        if (!(Test-Container -LiteralPath 'REGISTRY::HKEY_CLASSES_ROOT\CLSID\{177F0C4A-1CD3-4DE7-A32C-71DBBB9FA36D}')) {

            return

        }



        # If the type has already been loaded once, then it is not loaded again.

        Write-Host "Adding Visual Studio setup helpers."

        Add-Type -Debug:$false -TypeDefinition @'

namespace CapabilityHelpers.VisualStudio.Setup

{

    using System;

    using System.Collections.Generic;

    using CapabilityHelpers.VisualStudio.Setup.Com;



    public sealed class Instance

    {

        public string Description { get; set; }



        public string DisplayName { get; set; }



        public string Id { get; set; }



        public System.Runtime.InteropServices.ComTypes.FILETIME InstallDate { get; set; }



        public string Name { get; set; }



        public string Path { get; set; }



        public Version Version

        {

            get

            {

                try

                {

                    return new Version(VersionString);

                }

                catch (Exception)

                {

                    return new Version(0, 0);

                }

            }

        }



        public string VersionString { get; set; }



        public static List<Instance> GetInstances()

        {

            List<Instance> list = new List<Instance>();

            ISetupConfiguration config = new SetupConfiguration() as ISetupConfiguration;

            IEnumSetupInstances enumInstances = config.EnumInstances();

            ISetupInstance[] instances = new ISetupInstance[1];

            int fetched = 0;

            enumInstances.Next(1, instances, out fetched);

            while (fetched > 0)

            {

                ISetupInstance instance = instances[0];

                list.Add(new Instance()

                {

                    Description = instance.GetDescription(),

                    DisplayName = instance.GetDisplayName(),

                    Id = instance.GetInstanceId(),

                    InstallDate = instance.GetInstallDate(),

                    Name = instance.GetInstallationName(),

                    Path = instance.GetInstallationPath(),

                    VersionString = instance.GetInstallationVersion(),

                });



                enumInstances.Next(1, instances, out fetched);

            }



            return list;

        }

    }

}



namespace CapabilityHelpers.VisualStudio.Setup.Com

{

    using System;

    using System.Runtime.InteropServices;



    [ComImport]

    [Guid("6380BCFF-41D3-4B2E-8B2E-BF8A6810C848")]

    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]

    public interface IEnumSetupInstances

    {

        void Next(

            [In, MarshalAs(UnmanagedType.U4)] int celt,

            [Out, MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.Interface)] ISetupInstance[] rgelt,

            [Out, MarshalAs(UnmanagedType.U4)] out int pceltFetched);



        void Skip([In, MarshalAs(UnmanagedType.U4)] int celt);



        void Reset();



        [return: MarshalAs(UnmanagedType.Interface)]

        IEnumSetupInstances Clone();

    }



    [ComImport]

    [Guid("42843719-DB4C-46C2-8E7C-64F1816EFD5B")]

    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]

    public interface ISetupConfiguration

    {

        [return: MarshalAs(UnmanagedType.Interface)]

        IEnumSetupInstances EnumInstances();

    }



    [ComImport]

    [Guid("B41463C3-8866-43B5-BC33-2B0676F7F42E")]

    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]

    public interface ISetupInstance

    {

        [return: MarshalAs(UnmanagedType.BStr)]

        string GetInstanceId();



        [return: MarshalAs(UnmanagedType.Struct)]

        System.Runtime.InteropServices.ComTypes.FILETIME GetInstallDate();



        [return: MarshalAs(UnmanagedType.BStr)]

        string GetInstallationName();



        [return: MarshalAs(UnmanagedType.BStr)]

        string GetInstallationPath();



        [return: MarshalAs(UnmanagedType.BStr)]

        string GetInstallationVersion();



        [return: MarshalAs(UnmanagedType.BStr)]

        string GetDisplayName([In, MarshalAs(UnmanagedType.U4)] int lcid = default(int));



        [return: MarshalAs(UnmanagedType.BStr)]

        string GetDescription([In, MarshalAs(UnmanagedType.U4)] int lcid = default(int));

    }



    [ComImport]

    [Guid("42843719-DB4C-46C2-8E7C-64F1816EFD5B")]

    [CoClass(typeof(SetupConfigurationClass))]

    [TypeLibImportClass(typeof(SetupConfigurationClass))]

    public interface SetupConfiguration : ISetupConfiguration

    {

    }



    [ComImport]

    [Guid("177F0C4A-1CD3-4DE7-A32C-71DBBB9FA36D")]

    [ClassInterface(ClassInterfaceType.None)]

    public class SetupConfigurationClass

    {

    }

}

'@

        Write-Host "Getting Visual Studio setup instances."

        $instances = @( [CapabilityHelpers.VisualStudio.Setup.Instance]::GetInstances() )

        Write-Host "Found $($instances.Count) instances."

        Write-Host ($instances | Format-List * | Out-String)

        return $instances |

            Where-Object { $_.Version.Major -eq 15 } |

            Sort-Object -Descending -Property Version |

            Select-Object -First 1

    } catch {

        Write-Host ($_ | Out-String)

    }

}

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
		[string]$vsTestVersion,
		[string]$vsTestLocation
	)

	if ([string]::IsNullOrWhiteSpace($vsTestVersion))
	{
		$vsTestVersion = Get-VSVersion $vsTestLocation
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
		$teModesDll = [io.path]::Combine("$env:VS140COMNTools", "..", "IDE", "CommonExtensions", "Microsoft", "TestWindow", "TE.TestModes.dll");
		if(Test-Path -Path $teModesDll)
		{
			$devenvExe = [io.path]::Combine("$env:VS140COMNTools", "..", "IDE", "devenv.exe");
			$devenvVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($devenvExe);
			if($devenvVersion.ProductBuildPart -lt 25420) #update3 build#
			{
				# ensure the registry is set otherwise you need to launch VSIDE
				SetRegistryKeyForParallel $vsTestVersion
			}

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

function Get-VSVersion($vsTestLocation)
{
	if(![String]::IsNullOrWhiteSpace($vsTestLocation))
	{
		Write-Verbose "Using vstest location provided to get the version"
		$vstestConsoleExeVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($vsTestLocation);
		return $vstestConsoleExeVersion.ProductMajorPart;
	}

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