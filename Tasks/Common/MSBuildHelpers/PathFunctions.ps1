########################################
# Public functions.
########################################
function Get-MSBuildPath {
    [CmdletBinding()]
    param(
        [string]$Version,
        [string]$Architecture)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $msbuildUtilitiesAssemblies = @(
            "Microsoft.Build.Utilities.Core, Version=14.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a, processorArchitecture=MSIL"
            "Microsoft.Build.Utilities.v12.0, Version=12.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a, processorArchitecture=MSIL"
            "Microsoft.Build.Utilities.v4.0, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a, processorArchitecture=MSIL"
        )

        # Attempt to load a Microsoft build utilities DLL.
        $index = 0
        [System.Reflection.Assembly]$msUtilities = $null
        while ($msUtilities -eq $null -and $index -lt $msbuildUtilitiesAssemblies.Length) {
            try {
                $msUtilities = [System.Reflection.Assembly]::Load((New-Object System.Reflection.AssemblyName($msbuildUtilitiesAssemblies[$index])))
            } catch [System.IO.FileNotFoundException] { }

            $index++
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
                # is available in the 14.0 and 12.0 utilities DLL. It is not available in
                # the 4.0 utilities DLL.
                [System.Reflection.MethodInfo]$mi = $t.GetMethod(
                    "GetPathToBuildToolsFile",
                    [type[]]@( [string], [string], $msUtilities.GetType("Microsoft.Build.Utilities.DotNetFrameworkArchitecture") ))
                if ($mi -ne $null -and $mi.GetParameters().Length -eq 3) {
                    $versions = "14.0", "12.0", "4.0"
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
