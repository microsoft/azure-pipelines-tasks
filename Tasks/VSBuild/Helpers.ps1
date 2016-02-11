function Format-MSBuildArguments {
    [cmdletbinding()]
    param(
        [string]$MSBuildArguments,
        [string]$Platform,
        [string]$Configuration,
        [string]$VSVersion)

    # Append additional information to the MSBuild args.
    $MSBuildArguments = $MSBuildArguments;
    if ($Platform) {
        Write-Verbose "adding platform: $Platform"
        $MSBuildArguments = "$MSBuildArguments /p:platform=`"$Platform`""
    }

    if ($Configuration) {
        Write-Verbose "adding configuration: $Configuration"
        $MSBuildArguments = "$MSBuildArguments /p:configuration=`"$Configuration`""
    }

    if ($VSVersion) {
        Write-Verbose ('adding VisualStudioVersion: {0}' -f $VSVersion)
        $MSBuildArguments = "$MSBuildArguments /p:VisualStudioVersion=`"$VSVersion`""
    }

    Write-Verbose "MSBuildArguments = $MSBuildArguments"
    $MSBuildArguments
}

function Get-SolutionFiles {
    [cmdletbinding()]
    param([string]$Solution)

    # check for solution pattern
    if ($Solution.Contains("*") -or $Solution.Contains("?")) {
        Write-Verbose "Pattern found in solution parameter."
        Write-Verbose "Find-Files -SearchPattern $Solution"
        $solutionFiles = Find-Files -SearchPattern $Solution
        Write-Verbose "solutionFiles = $solutionFiles"
    } else {
        Write-Verbose "No Pattern found in solution parameter."
        $solutionFiles = ,$Solution
    }

    if (!$solutionFiles) {
        throw (Get-LocalizedString -Key "No solution was found using search pattern '{0}'." -ArgumentList $Solution)
    }

    $solutionFiles
}

function Invoke-BuildTools {
    [cmdletbinding()]
    param(
        [switch]$NuGetRestore,
        [string[]]$SolutionFiles,
        [string]$MSBuildLocation,
        [string]$MSBuildArguments,
        [switch]$Clean,
        [switch]$NoTimelineLogger)

    $nugetPath = Get-ToolPath -Name 'NuGet.exe'
    if (-not $nugetPath -and $NuGetRestore) {
        Write-Warning (Get-LocalizedString -Key "Unable to locate nuget.exe. Package restore will not be performed for the solutions")
    }

    foreach ($file in $SolutionFiles) {
        if ($nugetPath -and $NuGetRestore) {
            if ($env:NUGET_EXTENSIONS_PATH) {
                Write-Host (Get-LocalizedString -Key "Detected NuGet extensions loader path. Environment variable NUGET_EXTENSIONS_PATH is set to: {0}" -ArgumentList $env:NUGET_EXTENSIONS_PATH)
            }

            $slnFolder = [System.IO.Path]::GetDirectoryName($file)
            Write-Verbose "Running nuget package restore for $slnFolder"
            Invoke-Tool -Path $nugetPath -Arguments "restore `"$file`" -NonInteractive" -WorkingFolder $slnFolder
        }

        if ($Clean) {
            Invoke-MSBuild $file -Targets Clean -LogFile "$file-clean.log" -ToolLocation $MSBuildLocation -CommandLineArgs $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger
        }

        Invoke-MSBuild $file -LogFile "$file.log" -ToolLocation $MSBuildLocation -CommandLineArgs $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger
    }
}

function Select-MSBuildLocation {
    [cmdletbinding()]
    param([string]$VSVersion, [string]$Architecture)

    # Determine which MSBuild version to use.
    $msBuildVersion = $null;
    switch ("$VSVersion") {
        '' { break }
        '14.0' { $msBuildVersion = '14.0' ; break }
        '12.0' { $msBuildVersion = '12.0' ; break }
        '11.0' { $msBuildVersion = '4.0' ; break }
        '10.0' { $msBuildVersion = '4.0' ; break }
        default { throw (Get-LocalizedString -Key "Unexpected Visual Studio version '{0}'." -ArgumentList $VSVersion) }
    }

    # Find the MSBuild location.
    Write-Verbose "Finding MSBuild location for version: $msBuildVersion"
    $msBuildLocation = Get-MSBuildLocation -Version $msBuildVersion -Architecture $Architecture
    if (!$msBuildLocation) {
        throw (Get-LocalizedString -Key 'MSBuild not found: Version = {0}, Architecture = {1}' -ArgumentList $msBuildVersion, $Architecture)
    }

    Write-Verbose "msBuildLocation = $msBuildLocation"
    $msBuildLocation
}

function Select-VSVersion {
    [cmdletbinding()]
    param([string]$PreferredVersion)

    # Look for a specific version of Visual Studio.
    if ($PreferredVersion -and "$PreferredVersion".ToUpperInvariant() -ne 'LATEST') {
        Write-Verbose "Searching for Visual Studio version: $PreferredVersion"
        $location = Get-VisualStudioPath -Version $PreferredVersion
        if ($location) {
            Write-Verbose ('VS version = {0}' -f $PreferredVersion)
            Write-Verbose ('VS location = {0}' -f $location)
            return $PreferredVersion
        }

        Write-Warning (Get-LocalizedString -Key 'Visual Studio not found: Version = {0}. Looking for the latest version.' -ArgumentList $PreferredVersion)
    }

    # Look for the latest version of Visual Studio.
    Write-Verbose 'Searching for the latest Visual Studio version.'
    [string[]]$knownVersions = '14.0', '12.0', '11.0', '10.0' |
        Where-Object { $_ -ne $PreferredVersion }
    foreach ($version in $knownVersions) {
        Write-Verbose "Searching for Visual Studio version: $version"
        $location = Get-VisualStudioPath -Version $version
        if ($location) {
            Write-Verbose ('VS version = {0}' -f $version)
            Write-Verbose ('VS location = {0}' -f $location)
            return $version
        }
    }

    Write-Warning (Get-LocalizedString -Key 'Visual Studio not found. Try installing a supported version of Visual Studio. See the task definition for a list of supported versions.')
}
