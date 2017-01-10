########################################
# Public functions.
########################################
function Get-MSBuildPath {
    [CmdletBinding()]
    param(
        [string]$Version,
        [string]$Architecture,
        [switch]$SearchCom)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Attempt to find Microsoft.Build.Utilities.Core.dll from a VS 15 Willow install.
        [System.Reflection.Assembly]$msUtilities = $null
        if ($SearchCom -and
            ($visualStudio15 = Get-VisualStudio_15_0) -and
            $visualStudio15.Path) {

            $msbuildUtilitiesPath = [System.IO.Path]::Combine($visualStudio15.Path, "MSBuild\15.0\Bin\Microsoft.Build.Utilities.Core.dll")
            if (Test-Path -LiteralPath $msbuildUtilitiesPath -PathType Leaf) {
                Write-Verbose "Loading $msbuildUtilitiesPath"
                $msUtilities = [System.Reflection.Assembly]::LoadFrom($msbuildUtilitiesPath)
            }
        }

        # Fallback to searching the GAC.
        if (!$msUtilities) {
            $msbuildUtilitiesAssemblies = @(
                "Microsoft.Build.Utilities.Core, Version=15.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a, processorArchitecture=MSIL"
                "Microsoft.Build.Utilities.Core, Version=14.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a, processorArchitecture=MSIL"
                "Microsoft.Build.Utilities.v12.0, Version=12.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a, processorArchitecture=MSIL"
                "Microsoft.Build.Utilities.v4.0, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a, processorArchitecture=MSIL"
            )

            # Attempt to load a Microsoft build utilities DLL.
            $index = 0
            [System.Reflection.Assembly]$msUtilities = $null
            while (!$msUtilities -and $index -lt $msbuildUtilitiesAssemblies.Length) {
                Write-Verbose "Loading $($msbuildUtilitiesAssemblies[$index])"
                try {
                    $msUtilities = [System.Reflection.Assembly]::Load((New-Object System.Reflection.AssemblyName($msbuildUtilitiesAssemblies[$index])))
                } catch [System.IO.FileNotFoundException] {
                    Write-Verbose "Not found."
                }

                $index++
            }
        }

        [string]$msBuildPath = $null

        # Default to x86 architecture if not specified.
        if (!$Architecture) {
            $Architecture = "x86"
        }

        if ($msUtilities -ne $null) {
            [type]$t = $msUtilities.GetType('Microsoft.Build.Utilities.ToolLocationHelper')
            if ($t -ne $null) {
                # Attempt to load the method info for GetPathToBuildToolsFile. This method
                # is available in the 15.0, 14.0, and 12.0 utilities DLL. It is not available
                # in the 4.0 utilities DLL.
                [System.Reflection.MethodInfo]$mi = $t.GetMethod(
                    "GetPathToBuildToolsFile",
                    [type[]]@( [string], [string], $msUtilities.GetType("Microsoft.Build.Utilities.DotNetFrameworkArchitecture") ))
                if ($mi -ne $null -and $mi.GetParameters().Length -eq 3) {
                    $versions = "15.0", "14.0", "12.0", "4.0"
                    if ($Version) {
                        $versions = @( $Version )
                    }

                    # Translate the architecture parameter into the corresponding value of the
                    # DotNetFrameworkArchitecture enum. Parameter three of the target method info
                    # takes this enum. Leverage parameter three to get to the enum's type info.
                    $param3 = $mi.GetParameters()[2]
                    $archValues = [System.Enum]::GetValues($param3.ParameterType)
                    [object]$archValue = $null
                    if ($Architecture -eq 'x86') {
                        $archValue = $archValues.GetValue(1) # DotNetFrameworkArchitecture.Bitness32
                    } elseif ($Architecture -eq 'x64') {
                        $archValue = $archValues.GetValue(2) # DotNetFrameworkArchitecture.Bitness64
                    } else {
                        $archValue = $archValues.GetValue(1) # DotNetFrameworkArchitecture.Bitness32
                    }

                    # Attempt to resolve the path for each version.
                    $versionIndex = 0
                    while (!$msBuildPath -and $versionIndex -lt $versions.Length) {
                        $msBuildPath = $mi.Invoke(
                            $null,
                            @( 'msbuild.exe' # string fileName
                                $versions[$versionIndex] # string toolsVersion
                                $archValue ))
                        $versionIndex++
                    }
                } elseif (!$Version -or $Version -eq "4.0") {
                    # Attempt to load the method info GetPathToDotNetFrameworkFile. This method
                    # is available in the 4.0 utilities DLL.
                    $mi = $t.GetMethod(
                        "GetPathToDotNetFrameworkFile",
                        [type[]]@( [string], $msUtilities.GetType("Microsoft.Build.Utilities.TargetDotNetFrameworkVersion"), $msUtilities.GetType("Microsoft.Build.Utilities.DotNetFrameworkArchitecture") ))
                    if ($mi -ne $null -and $mi.GetParameters().Length -eq 3) {
                        # Parameter two of the target method info takes the TargetDotNetFrameworkVersion
                        # enum. Leverage parameter two to get the enum's type info.
                        $param2 = $mi.GetParameters()[1];
                        $frameworkVersionValues = [System.Enum]::GetValues($param2.ParameterType);

                        # Translate the architecture parameter into the corresponding value of the
                        # DotNetFrameworkArchitecture enum. Parameter three of the target method info
                        # takes this enum. Leverage parameter three to get to the enum's type info.
                        $param3 = $mi.GetParameters()[2];
                        $archValues = [System.Enum]::GetValues($param3.ParameterType);
                        [object]$archValue = $null
                        if ($Architecture -eq "x86") {
                            $archValue = $archValues.GetValue(1) # DotNetFrameworkArchitecture.Bitness32
                        } elseif ($Architecture -eq "x64") {
                            $archValue = $archValues.GetValue(2) # DotNetFrameworkArchitecture.Bitness64
                        } else {
                            $archValue = $archValues.GetValue(1) # DotNetFrameworkArchitecture.Bitness32
                        }

                        # Attempt to resolve the path.
                        $msBuildPath = $mi.Invoke(
                            $null,
                            @( "msbuild.exe" # string fileName
                                $frameworkVersionValues.GetValue($frameworkVersionValues.Length - 1) # enum TargetDotNetFrameworkVersion.VersionLatest
                                $archValue ))
                    }
                }
            }
        }

        if ($msBuildPath -and (Test-Path -LiteralPath $msBuildPath -PathType Leaf)) {
            Write-Verbose "MSBuild: $msBuildPath"
            $msBuildPath
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-SolutionFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Solution)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Solution.Contains("*") -or $Solution.Contains("?")) {
            $solutionFiles = Find-VstsFiles -LegacyPattern $Solution
            if (!$solutionFiles.Count) {
                throw (Get-VstsLocString -Key MSB_SolutionNotFoundUsingSearchPattern0 -ArgumentList $Solution)
            }
        } else {
            $solutionFiles = ,$Solution
        }

        $solutionFiles
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-VisualStudio_15_0 {
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Short-circuit if the setup configuration class ID isn't registered.
        Write-Verbose "Testing for class ID."
        if (!(Test-Path -LiteralPath 'REGISTRY::HKEY_CLASSES_ROOT\CLSID\{177F0C4A-1CD3-4DE7-A32C-71DBBB9FA36D}')) {
            return
        }

        # If the type has already been loaded once, then it is not loaded again.
        Write-Verbose "Adding Visual Studio setup helpers."
        Add-Type -Debug:$false -TypeDefinition @'
namespace MSBuildHelpers.VisualStudio.Setup
{
    using System;
    using System.Collections.Generic;
    using MSBuildHelpers.VisualStudio.Setup.Com;

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

namespace MSBuildHelpers.VisualStudio.Setup.Com
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

        Write-Verbose "Getting Visual Studio setup instances."
        $instances = @( [MSBuildHelpers.VisualStudio.Setup.Instance]::GetInstances() )
        Write-Verbose "Found $($instances.Count) instances."
        Write-Verbose ($instances | Format-List * | Out-String)
        return $instances |
            Where-Object { $_.Version.Major -eq 15 -and $_.Version.Minor -eq 0 } |
            Sort-Object -Descending -Property Version |
            Select-Object -First 1
    } catch {
        Write-Verbose ($_ | Out-String)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
